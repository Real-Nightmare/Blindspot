import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent, createAuth } from "./auth";
import { requireApproved, requireProfile, audit } from "./authz";

/** Public identity: never exposes email, full name or verification data. */
export const publicProfile = query({
  args: { userId: v.id("profiles") },
  handler: async (ctx, args) => {
    await requireApproved(ctx);
    const p = await ctx.db.get(args.userId);
    if (!p) return null;
    return {
      _id: p._id,
      username: p.username,
      displayName: p.displayName ?? p.username,
      bio: p.bio ?? null,
      statusEmoji: p.statusEmoji ?? null,
      statusText: p.statusText ?? null,
      avatarStorageId: p.avatarStorageId ?? null,
      role: p.role,
      lastActiveAt: p.showLastActive ? p.lastActiveAt ?? null : null,
    };
  },
});

export const getAvatarUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireApproved(ctx);
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    statusEmoji: v.optional(v.string()),
    statusText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireApproved(ctx);
    if (args.displayName !== undefined && args.displayName.length > 60) {
      throw new Error("Display name too long");
    }
    if (args.bio !== undefined && args.bio.length > 400) {
      throw new Error("Bio too long");
    }
    const patch: Record<string, string | undefined> = {};
    if (args.displayName !== undefined) patch.displayName = args.displayName;
    if (args.bio !== undefined) patch.bio = args.bio;
    if (args.statusEmoji !== undefined) patch.statusEmoji = args.statusEmoji;
    if (args.statusText !== undefined) patch.statusText = args.statusText;
    await ctx.db.patch(profile._id, patch);
  },
});

const NOTIF_KEYS = [
  "notifyMessages",
  "notifyMentions",
  "notifyCalls",
  "notifyGroups",
  "notifyApprovals",
  "notifyModeration",
] as const;

const PRIVACY_KEYS = [
  "allowDmFrom",
  "allowGroupInvites",
  "showOnline",
  "showLastActive",
  "showReadReceipts",
  "showTyping",
  "discoverable",
  "quietMode",
] as const;

export const updateNotificationPrefs = mutation({
  args: {
    notifyMessages: v.optional(v.boolean()),
    notifyMentions: v.optional(v.boolean()),
    notifyCalls: v.optional(v.boolean()),
    notifyGroups: v.optional(v.boolean()),
    notifyApprovals: v.optional(v.boolean()),
    notifyModeration: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    await ctx.db.patch(profile._id, args);
  },
});

export const updatePrivacyPrefs = mutation({
  args: {
    allowDmFrom: v.optional(v.union(v.literal("everyone"), v.literal("nobody"))),
    allowGroupInvites: v.optional(v.boolean()),
    showOnline: v.optional(v.boolean()),
    showLastActive: v.optional(v.boolean()),
    showReadReceipts: v.optional(v.boolean()),
    showTyping: v.optional(v.boolean()),
    discoverable: v.optional(v.boolean()),
    quietMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    await ctx.db.patch(profile._id, args);
  },
});

/** Directory of discoverable members for starting DMs. */
export const discoverUsers = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("status", (q) => q.eq("status", "approved"))
      .take(300);
    const q = (args.search ?? "").toLowerCase();
    return profiles
      .filter((p) => p._id !== me._id)
      .filter((p) => p.discoverable !== false)
      .filter((p) => !q || p.username.toLowerCase().includes(q))
      .map((p) => ({
        _id: p._id,
        username: p.username,
        displayName: p.displayName ?? p.username,
        avatarStorageId: p.avatarStorageId ?? null,
        statusEmoji: p.statusEmoji ?? null,
        statusText: p.statusText ?? null,
      }));
  },
});

// ---------------------------------------------------------------- sessions ---

export const listMySessions = query({
  args: {},
  handler: async (ctx) => {
    await requireProfile(ctx);
    const authUser = await authComponent.getAuthUser(ctx);
    return authUser
      ? [{ id: authUser.id, email: authUser.email, createdAt: authUser.createdAt }]
      : [];
  },
});

export const changePassword = mutation({
  args: { currentPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    await auth.api.changePassword({
      body: {
        currentPassword: args.currentPassword,
        newPassword: args.newPassword,
        revokeOtherSessions: true,
      },
      headers,
    });
    await audit(ctx, profile, "account.passwordChanged", {
      targetType: "profile",
      targetId: profile._id,
    });
    return { ok: true };
  },
});

export const signOutEverywhere = mutation({
  args: {},
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    await auth.api.revokeSessions({ headers });
    await audit(ctx, profile, "account.signedOutAll", {
      targetType: "profile",
      targetId: profile._id,
    });
    return { ok: true };
  },
});

export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    if (profile.role === "creator") {
      throw new Error(
        "The creator account cannot be deleted. Transfer ownership first.",
      );
    }
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    await auth.api.deleteUser({ headers });
    await audit(ctx, profile, "account.deleted", {
      targetType: "profile",
      targetId: profile._id,
      summary: profile.username,
    });
    return { ok: true };
  },
});
