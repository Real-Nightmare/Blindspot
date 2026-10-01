import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Profile lookup by Better Auth subject, for actions that can't use ctx.db. */
export const myProfileInternal = internalQuery({
  args: { subject: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("authUserId", (q) => q.eq("authUserId", args.subject))
      .unique();
  },
});

export const userMessages = internalQuery({
  args: { userId: v.id("profiles") },
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("authorId", (q) => q.eq("authorId", args.userId))
      .take(2000);
    return msgs.map((m) => ({
      conversationId: m.conversationId,
      kind: m.kind,
      body: m.body ?? null,
      createdAt: new Date(m._creationTime).toISOString(),
      editedAt: m.editedAt ? new Date(m.editedAt).toISOString() : null,
    }));
  },
});

export const userNotifications = internalQuery({
  args: { userId: v.id("profiles") },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("notifications")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .take(1000);
    return docs.map((n) => ({
      kind: n.kind,
      title: n.title,
      body: n.body ?? null,
      read: n.read,
      createdAt: new Date(n.createdAt).toISOString(),
    }));
  },
});

export const userGroups = internalQuery({
  args: { userId: v.id("profiles") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();
    const result: { name: string; role: string; joinedAt: string }[] = [];
    for (const m of memberships) {
      const g = await ctx.db.get(m.groupId);
      if (g) {
        result.push({ name: g.name, role: m.role, joinedAt: new Date(m.joinedAt).toISOString() });
      }
    }
    return result;
  },
});
