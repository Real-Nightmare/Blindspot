import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  requireApproved,
  requireProfile,
  isAdmin,
  assertConversationParticipant,
  isBlockedBetween,
  audit,
  type Profile,
} from "./authz";
import { rateLimit } from "./rateLimit";

// ------------------------------------------------------------ conversations ---

export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireApproved(ctx);
    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("userId_state", (q) => q.eq("userId", me._id).eq("state", "active"))
      .collect();
    const result: {
      conversationId: Id<"conversations">;
      kind: "dm" | "group" | "global";
      title: string;
      avatarId: string | null;
      lastMessageAt: number;
      lastMessagePreview: string;
      unread: boolean;
      disappearingSeconds: number | null;
    }[] = [];
    for (const m of memberships) {
      const conv = await ctx.db.get(m.conversationId);
      if (!conv) continue;
      let title = "Global Chat";
      let avatarId: string | null = null;
      if (conv.kind === "dm") {
        const other = conv.userA === me._id ? conv.userB : conv.userA;
        const otherProfile = other ? await ctx.db.get(other) : null;
        title = otherProfile?.username ?? "unknown";
        avatarId = otherProfile?.avatarStorageId ?? null;
      } else if (conv.kind === "group" && conv.groupId) {
        const group = await ctx.db.get(conv.groupId);
        title = group?.name ?? "Group";
        avatarId = group?.avatarStorageId ?? null;
      }
      const unread = conv.lastMessageAt
        ? !m.lastReadAt || conv.lastMessageAt > m.lastReadAt
        : false;
      result.push({
        conversationId: conv._id,
        kind: conv.kind,
        title,
        avatarId,
        lastMessageAt: conv.lastMessageAt ?? conv._creationTime,
        lastMessagePreview: conv.lastMessagePreview ?? "",
        unread,
        disappearingSeconds: conv.disappearingSeconds ?? null,
      });
    }
    return result.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },
});

export const openDm = mutation({
  args: { otherUserId: v.id("profiles") },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    if (me._id === args.otherUserId) throw new Error("Cannot message yourself");
    const other = await ctx.db.get(args.otherUserId);
    if (!other || other.status !== "approved") {
      throw new Error("User is not available");
    }
    if (other.allowDmFrom === "nobody") {
      throw new Error("This person is not accepting direct messages");
    }
    if (await isBlockedBetween(ctx, me._id, args.otherUserId)) {
      throw new Error("Conversation unavailable");
    }
    const userA = me._id < args.otherUserId ? me._id : args.otherUserId;
    const userB = me._id < args.otherUserId ? args.otherUserId : me._id;
    const existing = await ctx.db
      .query("conversations")
      .withIndex("pair", (q) => q.eq("userA", userA).eq("userB", userB))
      .first();
    if (existing) {
      const membership = await ctx.db
        .query("conversationMembers")
        .withIndex("conversationId_userId", (q) =>
          q.eq("conversationId", existing._id).eq("userId", me._id),
        )
        .first();
      if (!membership) {
        await ctx.db.insert("conversationMembers", {
          conversationId: existing._id,
          userId: me._id,
          joinedAt: Date.now(),
          state: "active",
        });
      }
      return existing._id;
    }
    const conversationId = await ctx.db.insert("conversations", {
      kind: "dm",
      userA,
      userB,
    });
    for (const uid of [userA, userB]) {
      await ctx.db.insert("conversationMembers", {
        conversationId,
        userId: uid,
        joinedAt: Date.now(),
        state: "active",
      });
    }
    return conversationId;
  },
});

// ---------------------------------------------------------------- messages ---

export const listMessages = query({
  args: {
    conversationId: v.id("conversations"),
    before: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    await assertConversationParticipant(ctx, args.conversationId, me._id);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    let messages: Doc<"messages">[];
    if (args.before) {
      const page = await ctx.db
        .query("messages")
        .withIndex("conversationId_creation", (q) =>
          q.eq("conversationId", args.conversationId).lt("_creationTime", args.before!),
        )
        .order("desc")
        .take(args.limit ?? 40);
      messages = page.reverse();
    } else {
      const page = await ctx.db
        .query("messages")
        .withIndex("conversationId_creation", (q) =>
          q.eq("conversationId", args.conversationId),
        )
        .order("desc")
        .take(args.limit ?? 40);
      messages = page.reverse();
    }

    const memberIds = new Set<string>();
    if (conversation.kind === "dm") {
      if (conversation.userA) memberIds.add(conversation.userA);
      if (conversation.userB) memberIds.add(conversation.userB);
    }

    const result: {
      _id: Id<"messages">;
      authorId: Id<"profiles">;
      authorUsername: string;
      authorAvatar: string | null;
      kind: "text" | "image" | "file" | "voice" | "system" | "call";
      body: string | null;
      replyTo: { _id: Id<"messages">; authorUsername: string; preview: string } | null;
      editedAt: number | null;
      deletedAt: number | null;
      attachmentId: string | null;
      attachmentName: string | null;
      attachmentType: string | null;
      attachmentSize: number | null;
      durationMs: number | null;
      expiresAt: number | null;
      callMeta: NonNullable<Doc<"messages">["callMeta"]> | null;
      reactions: { counts: Record<string, number>; mine: string | null };
      createdAt: number;
      mine: boolean;
    }[] = [];
    for (const m of messages) {
      if (m.deletedAt && !isAdmin(me)) continue;
      const author = await ctx.db.get(m.authorId);
      const reactions = await ctx.db
        .query("reactions")
        .withIndex("messageId", (q) => q.eq("messageId", m._id))
        .collect();
      const replyTo = m.replyToId ? await ctx.db.get(m.replyToId) : null;
      let blockedBetween = false;
      if (conversation.kind === "dm" && m.authorId !== me._id) {
        const other = m.authorId;
        const block = await ctx.db
          .query("blocks")
          .withIndex("blockerId_blockedId", (q) =>
            q.eq("blockerId", me._id).eq("blockedId", other),
          )
          .first();
        blockedBetween = Boolean(block);
      }
      const reactionCounts: Record<string, number> = {};
      let mineEmoji: string | null = null;
      for (const r of reactions) {
        reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
        if (r.userId === me._id) mineEmoji = r.emoji;
      }
      result.push({
        _id: m._id,
        authorId: m.authorId,
        authorUsername: author?.username ?? "unknown",
        authorAvatar: author?.avatarStorageId ?? null,
        kind: m.kind,
        body: m.deletedAt ? "[removed]" : blockedBetween ? "[hidden]" : m.body ?? null,
        replyTo: replyTo
          ? {
              _id: replyTo._id,
              authorUsername:
                (await ctx.db.get(replyTo.authorId))?.username ?? "unknown",
              preview: (replyTo.body ?? "").slice(0, 80),
            }
          : null,
        editedAt: m.editedAt ?? null,
        deletedAt: m.deletedAt ?? null,
        attachmentId: m.attachmentId ?? null,
        attachmentName: m.attachmentName ?? null,
        attachmentType: m.attachmentType ?? null,
        attachmentSize: m.attachmentSize ?? null,
        durationMs: m.durationMs ?? null,
        expiresAt: m.expiresAt ?? null,
        callMeta: m.callMeta ?? null,
        reactions: { counts: reactionCounts, mine: mineEmoji },
        createdAt: m._creationTime,
        mine: m.authorId === me._id,
      });
    }
    void memberIds;
    return result;
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
    replyToId: v.optional(v.id("messages")),
    attachmentId: v.optional(v.id("_storage")),
    attachmentName: v.optional(v.string()),
    attachmentType: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    kind: v.optional(
      v.union(
        v.literal("text"),
        v.literal("image"),
        v.literal("file"),
        v.literal("voice"),
      ),
    ),
    durationMs: v.optional(v.number()),
    expiresInSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    await rateLimit(ctx, "sendMessage", me._id, { max: 60, windowMs: 60_000 });
    await assertConversationParticipant(ctx, args.conversationId, me._id);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    if (conversation.kind === "global") {
      const flags = await ctx.db.query("siteSettings").collect();
      if (flags.some((f) => f.key === "globalChatEnabled" && f.value === false)) {
        throw new Error("Global Chat is currently disabled");
      }
    }
    if (conversation.kind === "dm") {
      const other = conversation.userA === me._id ? conversation.userB : conversation.userA;
      if (other && (await isBlockedBetween(ctx, me._id, other))) {
        throw new Error("Conversation unavailable");
      }
    }

    const body = args.body.trim();
    const hasAttachment = Boolean(args.attachmentId);
    if (!body && !hasAttachment) throw new Error("Message is empty");
    if (body.length > 4000) throw new Error("Message too long (max 4000 chars)");

    // Mention detection: @username for notifications
    const mentions = [...body.matchAll(/@([a-zA-Z0-9_]{3,24})/g)].map((m) => m[1]);

    const expiresAt = args.expiresInSeconds
      ? Date.now() + args.expiresInSeconds * 1000
      : conversation.disappearingSeconds
        ? Date.now() + conversation.disappearingSeconds * 1000
        : undefined;

    const kind = args.attachmentId
      ? args.attachmentType?.startsWith("image/")
        ? "image"
        : args.attachmentType?.startsWith("audio/")
          ? "voice"
          : "file"
      : "text";

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      authorId: me._id,
      body: body || undefined,
      kind,
      replyToId: args.replyToId,
      attachmentId: args.attachmentId,
      attachmentName: args.attachmentName,
      attachmentType: args.attachmentType,
      attachmentSize: args.attachmentSize,
      durationMs: args.durationMs,
      expiresAt,
    });

    const preview = body
      ? body.slice(0, 60)
      : kind === "image"
        ? "📷 Photo"
        : "📎 File";
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
      lastMessagePreview: preview,
    });

    await ctx.db
      .query("conversationMembers")
      .withIndex("conversationId", (q) => q.eq("conversationId", args.conversationId))
      .collect()
      .then(async (members) => {
        for (const m of members) {
          if (m.userId === me._id) continue;
          const memberProfile = await ctx.db.get(m.userId);
          const wantsMessages = memberProfile?.notifyMessages !== false;
          const mentioned = mentions.some(
            (u) => u.toLowerCase() === memberProfile?.username.toLowerCase(),
          );
          const wantsMentions = memberProfile?.notifyMentions !== false;
          const memberConv = await ctx.db
            .query("conversationMembers")
            .withIndex("conversationId_userId", (q) =>
              q.eq("conversationId", args.conversationId).eq("userId", m.userId),
            )
            .first();
          const lastRead = memberConv?.lastReadAt ?? 0;
          const isMention = mentioned && wantsMentions;
          if (conversation.kind === "dm" ? wantsMessages : isMention || (wantsMessages && conversation.kind === "group")) {
            if (Date.now() - lastRead > 15000 || isMention) {
              await ctx.db.insert("notifications", {
                userId: m.userId,
                kind: isMention ? "mention" : "message",
                title: isMention
                  ? `${me.username} mentioned you`
                  : `${me.username} in ${conversation.kind === "dm" ? "a direct message" : "the conversation"}`,
                body: preview,
                link: "/app",
                read: false,
                actorId: me._id,
                createdAt: Date.now(),
              });
            }
          }
        }
      });

    return messageId;
  },
});

export const editMessage = mutation({
  args: { messageId: v.id("messages"), body: v.string() },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.authorId !== me._id) throw new Error("You can only edit your messages");
    if (message.deletedAt) throw new Error("Message was deleted");
    const body = args.body.trim();
    if (!body) throw new Error("Message is empty");
    if (body.length > 4000) throw new Error("Message too long");
    await ctx.db.patch(args.messageId, { body, editedAt: Date.now() });
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    const own = message.authorId === me._id;
    const staffCanModerate = isAdmin(me) || (await isGroupAdmin(ctx, message.conversationId, me._id));
    if (!own && !staffCanModerate) {
      throw new Error("Not authorized");
    }
    if (message.attachmentId) {
      const file = await ctx.db
        .query("files")
        .withIndex("storageId", (q) => q.eq("storageId", message.attachmentId!))
        .first();
      if (file && file.ownerId === me._id) {
        await ctx.db.patch(file._id, { deletedAt: Date.now() });
      }
    }
    await ctx.db.patch(args.messageId, {
      deletedAt: Date.now(),
      removedBy: own ? undefined : me._id,
    });
    if (!own) {
      await audit(ctx, me, "moderation.removeMessage", {
        targetType: "message",
        targetId: args.messageId,
      });
    }
  },
});

async function isGroupAdmin(
  ctx: any,
  conversationId: any,
  userId: any,
): Promise<boolean> {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || conversation.kind !== "group" || !conversation.groupId) {
    return false;
  }
  const membership = await ctx.db
    .query("groupMembers")
    .withIndex("groupId_userId", (q: any) =>
      q.eq("groupId", conversation.groupId).eq("userId", userId),
    )
    .first();
  return Boolean(membership && (membership.role === "owner" || membership.role === "admin"));
}

export const react = mutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    await assertConversationParticipant(ctx, message.conversationId, me._id);
    const existing = await ctx.db
      .query("reactions")
      .withIndex("messageId_userId", (q) =>
        q.eq("messageId", args.messageId).eq("userId", me._id),
      )
      .collect();
    const same = existing.find((r) => r.emoji === args.emoji);
    if (same) {
      await ctx.db.delete(same._id);
      return { toggled: "off" as const };
    }
    for (const r of existing) await ctx.db.delete(r._id);
    if (args.emoji.length > 8) throw new Error("Invalid emoji");
    await ctx.db.insert("reactions", {
      messageId: args.messageId,
      userId: me._id,
      emoji: args.emoji,
    });
    return { toggled: "on" as const };
  },
});

export const setTyping = mutation({
  args: { conversationId: v.id("conversations"), isTyping: v.boolean() },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const profile = await ctx.db.get(me._id);
    if (profile && profile.showTyping === false) return;
    await assertConversationParticipant(ctx, args.conversationId, me._id);
    const existing = await ctx.db
      .query("typing")
      .withIndex("conversationId_userId", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", me._id),
      )
      .first();
    if (args.isTyping) {
      if (existing) {
        await ctx.db.patch(existing._id, { at: Date.now() });
      } else {
        await ctx.db.insert("typing", {
          conversationId: args.conversationId,
          userId: me._id,
          at: Date.now(),
        });
      }
    } else if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const typingIn = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    await assertConversationParticipant(ctx, args.conversationId, me._id);
    const rows = await ctx.db
      .query("typing")
      .withIndex("conversationId", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    const cutoff = Date.now() - 6000;
    const names: string[] = [];
    for (const row of rows) {
      if (row.userId === me._id || row.at < cutoff) continue;
      const p = await ctx.db.get(row.userId);
      if (p) names.push(p.username);
    }
    return names;
  },
});

export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("conversationId_userId", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", me._id),
      )
      .first();
    if (membership) {
      await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
    }
  },
});

export const searchMessages = query({
  args: { q: v.string() },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const term = args.q.trim().toLowerCase();
    if (term.length < 2) return [];
    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("userId_state", (q2) => q2.eq("userId", me._id).eq("state", "active"))
      .collect();
    const convIds = new Set(memberships.map((m) => m.conversationId));
    const results: {
      _id: Id<"messages">;
      conversationId: Id<"conversations">;
      conversationTitle: string;
      authorUsername: string;
      body: string;
      createdAt: number;
    }[] = [];
    const mine = await ctx.db
      .query("messages")
      .withIndex("authorId", (q2) => q2.eq("authorId", me._id))
      .order("desc")
      .take(300);
    void mine;
    const all = await ctx.db.query("messages").order("desc").take(1000);
    for (const m of all) {
      if (!convIds.has(m.conversationId)) continue;
      if (!m.body || m.deletedAt) continue;
      if (m.body.toLowerCase().includes(term)) {
        const author = await ctx.db.get(m.authorId);
        const conv = await ctx.db.get(m.conversationId);
        results.push({
          _id: m._id,
          conversationId: m.conversationId,
          conversationTitle: conv?.kind === "dm" ? "Direct message" : conv?.kind === "global" ? "Global Chat" : "Group",
          authorUsername: author?.username ?? "unknown",
          body: m.body.slice(0, 120),
          createdAt: m._creationTime,
        });
        if (results.length >= 30) break;
      }
    }
    return results;
  },
});

export const togglePin = mutation({
  args: { conversationId: v.id("conversations"), messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    const canModerate =
      isAdmin(me) || (await isGroupAdmin(ctx, args.conversationId, me._id));
    if (!canModerate) throw new Error("Only moderators can pin messages");
    const pinned = conversation.pinnedMessageIds ?? [];
    const updated = pinned.includes(args.messageId)
      ? pinned.filter((id) => id !== args.messageId)
      : [...pinned.slice(-9), args.messageId];
    await ctx.db.patch(args.conversationId, { pinnedMessageIds: updated });
  },
});

export const pinnedMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    await requireApproved(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation?.pinnedMessageIds?.length) return [];
    const result: {
      _id: Id<"messages">;
      body: string;
      authorUsername: string;
      createdAt: number;
    }[] = [];
    for (const id of conversation.pinnedMessageIds) {
      const m = await ctx.db.get(id);
      if (m && !m.deletedAt) {
        const author = await ctx.db.get(m.authorId);
        result.push({
          _id: m._id,
          body: m.body ?? "[attachment]",
          authorUsername: author?.username ?? "unknown",
          createdAt: m._creationTime,
        });
      }
    }
    return result;
  },
});

// ------------------------------------------------------------ global chat ----

export const ensureGlobalChat = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("conversations")
      .withIndex("kind", (q) => q.eq("kind", "global"))
      .first();
    if (existing) return existing._id;
    const conversationId = await ctx.db.insert("conversations", { kind: "global" });
    const approved = await ctx.db
      .query("profiles")
      .withIndex("status", (q) => q.eq("status", "approved"))
      .collect();
    for (const p of approved) {
      await ctx.db.insert("conversationMembers", {
        conversationId,
        userId: p._id,
        joinedAt: Date.now(),
        state: "active",
      });
    }
    return conversationId;
  },
});

export const joinGlobalChat = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireApproved(ctx);
    const global = await ctx.db
      .query("conversations")
      .withIndex("kind", (q) => q.eq("kind", "global"))
      .first();
    if (!global) return;
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("conversationId_userId", (q) =>
        q.eq("conversationId", global._id).eq("userId", me._id),
      )
      .first();
    if (!membership) {
      await ctx.db.insert("conversationMembers", {
        conversationId: global._id,
        userId: me._id,
        joinedAt: Date.now(),
        state: "active",
      });
    }
  },
});

/** Global chat moderation view (staff). */
export const globalChatFeed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const global = await ctx.db
      .query("conversations")
      .withIndex("kind", (q) => q.eq("kind", "global"))
      .first();
    if (!global) return { conversationId: null, messages: [] };
    await assertConversationParticipant(ctx, global._id, me._id);
    const messages = await ctx.db
      .query("messages")
      .withIndex("conversationId_creation", (q) => q.eq("conversationId", global._id))
      .order("desc")
      .take(args.limit ?? 50);
    const result: {
      _id: Id<"messages">;
      authorId: Id<"profiles">;
      authorUsername: string;
      body: string;
      kind: "text" | "image" | "file" | "voice" | "system" | "call";
      deletedAt: number | null;
      removedBy: Id<"profiles"> | null;
      createdAt: number;
    }[] = [];
    for (const m of messages.reverse()) {
      const author = await ctx.db.get(m.authorId);
      result.push({
        _id: m._id,
        authorId: m.authorId,
        authorUsername: author?.username ?? "unknown",
        body: m.deletedAt ? "[removed]" : m.body ?? "",
        kind: m.kind,
        deletedAt: m.deletedAt ?? null,
        removedBy: m.removedBy ?? null,
        createdAt: m._creationTime,
      });
    }
    return { conversationId: global._id, messages: result };
  },
});

export type { Profile };
