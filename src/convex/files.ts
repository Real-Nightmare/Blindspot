import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  requireProfile,
  requireApproved,
  requirePermission,
  requireVerificationAccess,
  assertConversationParticipant,
  audit,
} from "./authz";
import { rateLimit } from "./rateLimit";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_PREFIXES = ["image/", "audio/", "video/", "text/", "application/pdf"];

function typeAllowed(type: string): boolean {
  if (!type) return false;
  return ALLOWED_PREFIXES.some((p) => type.startsWith(p));
}

/**
 * Short-lived upload URL. Checks site flags, permissions and the allowlist +
 * size cap before minting. The caller POSTs the file to the URL and then
 * records the storageId where appropriate (message, avatar, ...).
 */
export const requestUpload = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const uploads = await ctx.db
      .query("siteSettings")
      .withIndex("key", (q) => q.eq("key", "uploadsEnabled"))
      .first();
    if (uploads && uploads.value === false) {
      throw new Error("Uploads are disabled by the administrators");
    }
    if (args.size <= 0) throw new Error("Empty file");
    if (args.size > MAX_FILE_SIZE) throw new Error("File exceeds the 25 MB limit");
    if (!typeAllowed(args.type)) {
      throw new Error("This file type is not allowed");
    }
    await rateLimit(ctx, "upload", me._id, { max: 30, windowMs: 60 * 60 * 1000 });
    return await ctx.storage.generateUploadUrl();
  },
});

/** Avatar upload URL (no site-flag dependency; validated on set). */
export const requestAvatarUpload = mutation({
  args: {},
  handler: async (ctx) => {
    await requireProfile(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Attach an uploaded image as the caller's avatar. */
export const setAvatar = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    if (profile.avatarStorageId) {
      await ctx.storage.delete(profile.avatarStorageId).catch(() => {});
    }
    await ctx.db.patch(profile._id, { avatarStorageId: args.storageId });
    await audit(ctx, profile, "account.avatarChanged", {
      targetType: "profile",
      targetId: profile._id,
    });
    return { ok: true };
  },
});

/**
 * Resolve a URL for a chat attachment. Chat messages reference the raw
 * storageId in `attachmentId`, so we look the file up by storageId (files row
 * or message attachment) and only serve it to conversation participants or
 * the uploading owner.
 */
export const getAttachmentUrl = query({
  args: {
    storageId: v.id("_storage"),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);

    // 1. Registered file (files table keeps owner + optional conversation).
    const fileDoc = await ctx.db
      .query("files")
      .withIndex("storageId", (q) => q.eq("storageId", args.storageId))
      .first();
    if (fileDoc) {
      if (fileDoc.deletedAt) return null;
      if (fileDoc.ownerId === me._id) return await ctx.storage.getUrl(args.storageId);
      if (!fileDoc.conversationId) return null;
      await assertConversationParticipant(ctx, fileDoc.conversationId, me._id);
      return await ctx.storage.getUrl(args.storageId);
    }

    // 2. Message attachment. When the caller tells us the conversation, this
    //    is a single participant check + bounded scan of that conversation.
    if (args.conversationId) {
      await assertConversationParticipant(ctx, args.conversationId, me._id);
      const msgs = await ctx.db
        .query("messages")
        .withIndex("conversationId_creation", (q) =>
          q.eq("conversationId", args.conversationId!),
        )
        .order("desc")
        .take(200);
      if (msgs.some((m) => m.attachmentId === args.storageId)) {
        return await ctx.storage.getUrl(args.storageId);
      }
      return null;
    }

    // 3. No hint: bounded scan across the viewer's conversations.
    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("userId_state", (q) => q.eq("userId", me._id).eq("state", "active"))
      .collect();
    for (const membership of memberships.slice(0, 50)) {
      const msgs = await ctx.db
        .query("messages")
        .withIndex("conversationId_creation", (q) =>
          q.eq("conversationId", membership.conversationId),
        )
        .order("desc")
        .take(80);
      if (msgs.some((m) => m.attachmentId === args.storageId)) {
        return await ctx.storage.getUrl(args.storageId);
      }
    }
    return null;
  },
});

/** Resolve a URL for a files-table row (owner or conversation participants). */
export const getFileUrl = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const file = await ctx.db.get(args.fileId);
    if (!file || file.deletedAt) return null;
    if (file.ownerId !== me._id) {
      if (!file.conversationId) return null;
      await assertConversationParticipant(ctx, file.conversationId, me._id);
    }
    return await ctx.storage.getUrl(file.storageId);
  },
});

/**
 * Verification attachments are the most sensitive files in the system. Only
 * the uploading user or staff with explicit verification access may open one.
 */
export const getVerificationFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx);
    const own = await ctx.db
      .query("verification")
      .withIndex("userId", (q) => q.eq("userId", me._id))
      .take(100);
    if (own.some((d) => (d.fileIds ?? []).includes(args.storageId))) {
      return await ctx.storage.getUrl(args.storageId);
    }
    await requireVerificationAccess(ctx);
    return await ctx.storage.getUrl(args.storageId);
  },
});

/** Record a completed chat upload as a managed file row. */
export const finalizeUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    type: v.string(),
    size: v.number(),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    if (args.conversationId) {
      await assertConversationParticipant(ctx, args.conversationId, me._id);
    }
    const fileId = await ctx.db.insert("files", {
      storageId: args.storageId,
      ownerId: me._id,
      name: args.name,
      type: args.type,
      size: args.size,
      visibility: args.conversationId ? "conversation" : "private",
      conversationId: args.conversationId,
    });
    return fileId;
  },
});

/** Record a completed voice-note upload as a managed file row. */
export const finalizeVoiceMessage = mutation({
  args: {
    storageId: v.id("_storage"),
    durationMs: v.number(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    await ctx.db.insert("files", {
      storageId: args.storageId,
      ownerId: me._id,
      name: "Voice message",
      type: "audio/webm",
      size: args.size,
      visibility: "private",
    });
    return { durationMs: args.durationMs };
  },
});

/** Admin files list (Files section). */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "files");
    const docs = await ctx.db.query("files").order("desc").take(300);
    const result: {
      _id: Id<"files">;
      name: string;
      type: string;
      size: number;
      ownerUsername: string;
      visibility: "private" | "conversation";
      deletedAt: number | null;
      createdAt: number;
    }[] = [];
    for (const f of docs) {
      const owner = await ctx.db.get(f.ownerId);
      result.push({
        _id: f._id,
        name: f.name,
        type: f.type,
        size: f.size,
        ownerUsername: owner?.username ?? "unknown",
        visibility: f.visibility,
        deletedAt: f.deletedAt ?? null,
        createdAt: f._creationTime,
      });
    }
    return result;
  },
});

/** Admin: delete a file row and its blob. */
export const deleteFile = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const admin = await requirePermission(ctx, "files");
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");
    await ctx.storage.delete(file.storageId).catch(() => {});
    await ctx.db.patch(args.fileId, { deletedAt: Date.now() });
    await audit(ctx, admin, "files.deleted", {
      targetType: "file",
      targetId: args.fileId,
      summary: file.name,
    });
    return { ok: true };
  },
});

// ------------------------------------------------------------------ sweeps ---

/** Delete expired ephemeral messages (and their blobs). */
export const sweepExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("messages")
      .withIndex("expiresAt", (q) => q.lt("expiresAt", now))
      .take(500);
    for (const m of expired) {
      if (m.attachmentId) await ctx.storage.delete(m.attachmentId).catch(() => {});
      await ctx.db.delete(m._id);
    }
    return expired.length;
  },
});

/** Delete file rows (and blobs) older than the retention cutoff. */
export const sweepFiles = internalMutation({
  args: { olderThan: v.number() },
  handler: async (ctx, args) => {
    const stale = await ctx.db
      .query("files")
      .filter((q) => q.lt(q.field("_creationTime"), args.olderThan))
      .take(500);
    let removed = 0;
    for (const f of stale) {
      if (f.deletedAt) continue;
      await ctx.storage.delete(f.storageId).catch(() => {});
      await ctx.db.patch(f._id, { deletedAt: Date.now() });
      removed++;
    }
    return removed;
  },
});

/** Retention run: ephemeral sweep + optional retention-days file sweep. */
export const runSweep = action({
  args: {},
  handler: async (ctx): Promise<number> => {
    let removed = await ctx.runMutation(internal.files.sweepExpired, {});
    const flags = await ctx.runQuery(api.settings.getSiteFlags, {});
    if (flags.retentionDays && flags.retentionDays > 0) {
      const cutoff = Date.now() - flags.retentionDays * 24 * 60 * 60 * 1000;
      removed += await ctx.runMutation(internal.files.sweepFiles, { olderThan: cutoff });
    }
    return removed;
  },
});

// ------------------------------------------------------ data / self-service ---

type ExportPayload = {
  exportedAt: string;
  profile: {
    username: string;
    displayName: string | null;
    bio: string | null;
    email: string;
    createdAt: string;
  };
  messages: unknown[];
  notifications: unknown[];
  groups: unknown[];
};

/** Export everything associated with the caller, as a plain JSON object. */
export const exportMyData = action({
  args: {},
  handler: async (ctx): Promise<ExportPayload> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const profile: {
      _id: Id<"profiles">;
      username: string;
      displayName?: string;
      bio?: string;
      email: string;
      _creationTime: number;
    } | null = await ctx.runQuery(internal.exports.myProfileInternal, {
      subject: identity.subject,
    });
    if (!profile) throw new Error("Account not found");
    const [messages, notifications, groups] = await Promise.all([
      ctx.runQuery(internal.exports.userMessages, { userId: profile._id }),
      ctx.runQuery(internal.exports.userNotifications, { userId: profile._id }),
      ctx.runQuery(internal.exports.userGroups, { userId: profile._id }),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      profile: {
        username: profile.username,
        displayName: profile.displayName ?? null,
        bio: profile.bio ?? null,
        email: profile.email,
        createdAt: new Date(profile._creationTime).toISOString(),
      },
      messages,
      notifications,
      groups,
    };
  },
});

/** Remove the caller's files from storage. Account flagging happens after. */
export const deleteMyData = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireProfile(ctx);
    if (me.role === "creator") {
      throw new Error("The creator account cannot be deleted from here");
    }
    const files = await ctx.db
      .query("files")
      .withIndex("ownerId", (q) => q.eq("ownerId", me._id))
      .collect();
    for (const f of files) {
      if (f.deletedAt) continue;
      await ctx.storage.delete(f.storageId).catch(() => {});
      await ctx.db.patch(f._id, { deletedAt: Date.now() });
    }
    if (me.avatarStorageId) {
      await ctx.storage.delete(me.avatarStorageId).catch(() => {});
    }
    // Voice/attachment blobs from the caller's own messages.
    const own = await ctx.db
      .query("messages")
      .withIndex("authorId", (q) => q.eq("authorId", me._id))
      .take(2000);
    for (const m of own) {
      if (m.attachmentId) await ctx.storage.delete(m.attachmentId).catch(() => {});
    }
    await audit(ctx, me, "privacy.dataDeleted", {
      targetType: "profile",
      targetId: me._id,
    });
    return { ok: true };
  },
});
