import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireApproved, requirePermission, audit, isBlockedBetween } from "./authz";

export const listGroups = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireApproved(ctx);
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("userId", (q) => q.eq("userId", me._id))
      .collect();
    const result: {
      _id: Id<"groups">;
      name: string;
      description: string | null;
      isPrivate: boolean;
      memberCount: number;
      myRole: "owner" | "admin" | "member";
      state: "active" | "invited";
      avatarStorageId: string | null;
      allowFiles: boolean;
      allowVoice: boolean;
      slowModeSeconds: number | null;
      disappearingSeconds: number | null;
      inviteOnly: boolean;
    }[] = [];
    for (const m of memberships) {
      if (m.state === "banned") continue;
      const g = await ctx.db.get(m.groupId);
      if (!g) continue;
      result.push({
        _id: g._id,
        name: g.name,
        description: g.description ?? null,
        isPrivate: g.isPrivate,
        memberCount: g.memberCount,
        myRole: m.role,
        state: m.state,
        avatarStorageId: g.avatarStorageId ?? null,
        allowFiles: g.allowFiles,
        allowVoice: g.allowVoice,
        slowModeSeconds: g.slowModeSeconds ?? null,
        disappearingSeconds: g.disappearingSeconds ?? null,
        inviteOnly: g.inviteOnly,
      });
    }
    return result.sort((a, b) => b.memberCount - a.memberCount);
  },
});

export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isPrivate: v.boolean(),
    inviteOnly: v.boolean(),
    allowFiles: v.boolean(),
    allowVoice: v.boolean(),
    disappearingSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const name = args.name.trim();
    if (name.length < 2 || name.length > 60) throw new Error("Group name is 2-60 characters");
    const groupId = await ctx.db.insert("groups", {
      name,
      description: args.description?.trim() || undefined,
      createdBy: me._id,
      isPrivate: args.isPrivate,
      inviteOnly: args.inviteOnly,
      allowFiles: args.allowFiles,
      allowVoice: args.allowVoice,
      disappearingSeconds: args.disappearingSeconds,
      memberCount: 1,
    });
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: me._id,
      role: "owner",
      joinedAt: Date.now(),
      state: "active",
    });
    const conversationId = await ctx.db.insert("conversations", {
      kind: "group",
      groupId,
      createdBy: me._id,
    });
    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: me._id,
      joinedAt: Date.now(),
      state: "active",
    });
    await audit(ctx, me, "group.create", {
      targetType: "group",
      targetId: groupId,
      summary: name,
    });
    return { groupId, conversationId };
  },
});

export const groupDetails = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) throw new Error("Group not found");
    const myMembership = await ctx.db
      .query("groupMembers")
      .withIndex("groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", me._id),
      )
      .first();
    if (g.isPrivate && !myMembership) {
      throw new Error("This group is private");
    }
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const memberViews: {
      userId: Id<"profiles">;
      username: string;
      role: "owner" | "admin" | "member";
      state: "active" | "invited" | "banned";
      avatarStorageId: string | null;
    }[] = [];
    for (const m of members) {
      const p = await ctx.db.get(m.userId);
      memberViews.push({
        userId: m.userId,
        username: p?.username ?? "unknown",
        role: m.role,
        state: m.state,
        avatarStorageId: p?.avatarStorageId ?? null,
      });
    }
    return {
      _id: g._id,
      name: g.name,
      description: g.description ?? null,
      isPrivate: g.isPrivate,
      inviteOnly: g.inviteOnly,
      allowFiles: g.allowFiles,
      allowVoice: g.allowVoice,
      slowModeSeconds: g.slowModeSeconds ?? null,
      disappearingSeconds: g.disappearingSeconds ?? null,
      memberCount: g.memberCount,
      createdBy: g.createdBy,
      members: memberViews,
      myRole: myMembership?.role ?? null,
    };
  },
});

export const updateGroupSettings = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    allowFiles: v.optional(v.boolean()),
    allowVoice: v.optional(v.boolean()),
    slowModeSeconds: v.optional(v.number()),
    disappearingSeconds: v.optional(v.number()),
    isPrivate: v.optional(v.boolean()),
    inviteOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) throw new Error("Group not found");
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", me._id),
      )
      .first();
    const isStaff = me.role === "creator" || me.role === "admin";
    if (!membership || (membership.role !== "owner" && membership.role !== "admin" && !isStaff)) {
      throw new Error("Only group admins can change settings");
    }
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      if (args.name.trim().length < 2) throw new Error("Name too short");
      patch.name = args.name.trim();
    }
    if (args.description !== undefined) patch.description = args.description.trim() || undefined;
    if (args.allowFiles !== undefined) patch.allowFiles = args.allowFiles;
    if (args.allowVoice !== undefined) patch.allowVoice = args.allowVoice;
    if (args.slowModeSeconds !== undefined) patch.slowModeSeconds = args.slowModeSeconds;
    if (args.disappearingSeconds !== undefined) patch.disappearingSeconds = args.disappearingSeconds;
    if (args.isPrivate !== undefined) patch.isPrivate = args.isPrivate;
    if (args.inviteOnly !== undefined) patch.inviteOnly = args.inviteOnly;
    await ctx.db.patch(args.groupId, patch as never);
    await audit(ctx, me, "group.updateSettings", {
      targetType: "group",
      targetId: args.groupId,
      summary: g.name,
    });
  },
});

export const inviteToGroup = mutation({
  args: { groupId: v.id("groups"), userId: v.id("profiles") },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) throw new Error("Group not found");
    const myMembership = await ctx.db
      .query("groupMembers")
      .withIndex("groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", me._id),
      )
      .first();
    const canInvite = myMembership && myMembership.role !== "member" && myMembership.state === "active";
    const isStaff = me.role === "creator" || me.role === "admin";
    if (!canInvite && !isStaff) throw new Error("Only group admins can invite");
    const target = await ctx.db.get(args.userId);
    if (!target || target.status !== "approved") throw new Error("User not available");
    if (target.allowGroupInvites === false) {
      throw new Error("This person is not accepting group invitations");
    }
    if (await isBlockedBetween(ctx, me._id, args.userId)) {
      throw new Error("Cannot invite this user");
    }
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId),
      )
      .first();
    if (existing) throw new Error("Already a member or invited");
    await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      userId: args.userId,
      role: "member",
      joinedAt: Date.now(),
      state: "invited",
      invitedBy: me._id,
    });
    await ctx.db.insert("notifications", {
      userId: args.userId,
      kind: "group_invite",
      title: `Invited to ${g.name}`,
      body: g.description ?? "Open Blindspot to respond.",
      link: "/app",
      read: false,
      actorId: me._id,
      createdAt: Date.now(),
    });
  },
});

export const respondToInvite = mutation({
  args: {
    groupId: v.id("groups"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", me._id),
      )
      .first();
    if (!membership || membership.state !== "invited") {
      throw new Error("No pending invitation");
    }
    const g = await ctx.db.get(args.groupId);
    if (args.accept) {
      await ctx.db.patch(membership._id, { state: "active" });
      if (g) {
        await ctx.db.patch(args.groupId, { memberCount: g.memberCount + 1 });
        const conversation = await ctx.db
          .query("conversations")
          .withIndex("groupId", (q) => q.eq("groupId", args.groupId))
          .first();
        if (conversation) {
          await ctx.db.insert("conversationMembers", {
            conversationId: conversation._id,
            userId: me._id,
            joinedAt: Date.now(),
            state: "active",
          });
        }
      }
    } else {
      await ctx.db.delete(membership._id);
    }
  },
});

export const setGroupMemberRole = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("profiles"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) throw new Error("Group not found");
    const myMembership = await ctx.db
      .query("groupMembers")
      .withIndex("groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", me._id),
      )
      .first();
    if (!myMembership || myMembership.role !== "owner") {
      throw new Error("Only the group owner can change roles");
    }
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId),
      )
      .first();
    if (!membership) throw new Error("Member not found");
    await ctx.db.patch(membership._id, { role: args.role });
  },
});

export const removeGroupMember = mutation({
  args: { groupId: v.id("groups"), userId: v.id("profiles"), ban: v.boolean() },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) throw new Error("Group not found");
    const myMembership = await ctx.db
      .query("groupMembers")
      .withIndex("groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", me._id),
      )
      .first();
    const isStaff = me.role === "creator" || me.role === "admin";
    const canModerate =
      (myMembership && (myMembership.role === "owner" || myMembership.role === "admin")) ||
      isStaff;
    if (!canModerate) throw new Error("Not authorized");
    if (args.userId === g.createdBy) throw new Error("The group owner cannot be removed");
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId),
      )
      .first();
    if (!membership) throw new Error("Member not found");
    if (args.ban) {
      await ctx.db.patch(membership._id, { state: "banned" });
    } else {
      await ctx.db.delete(membership._id);
      await ctx.db.patch(args.groupId, { memberCount: Math.max(0, g.memberCount - 1) });
    }
    await audit(ctx, me, args.ban ? "group.banMember" : "group.removeMember", {
      targetType: "group",
      targetId: args.groupId,
      summary: `${g.name}: member removed`,
    });
  },
});

export const leaveGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) throw new Error("Group not found");
    if (g.createdBy === me._id) {
      throw new Error("Owners cannot leave their own group");
    }
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", me._id),
      )
      .first();
    if (membership) {
      await ctx.db.delete(membership._id);
      await ctx.db.patch(args.groupId, { memberCount: Math.max(0, g.memberCount - 1) });
    }
  },
});

// ------------------------------------------------- admin: groups management ---

export const adminListGroups = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "groups");
    const groups = await ctx.db.query("groups").collect();
    return groups.sort((a, b) => b.memberCount - a.memberCount);
  },
});

export const adminDeleteGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const me = await requirePermission(ctx, "groups");
    const g = await ctx.db.get(args.groupId);
    if (!g) throw new Error("Group not found");
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("groupId", (q) => q.eq("groupId", args.groupId))
      .first();
    if (conversation) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("conversationId_creation", (q) => q.eq("conversationId", conversation._id))
        .collect();
      for (const m of messages) await ctx.db.delete(m._id);
      const members = await ctx.db
        .query("conversationMembers")
        .withIndex("conversationId", (q) => q.eq("conversationId", conversation._id))
        .collect();
      for (const m of members) await ctx.db.delete(m._id);
      await ctx.db.delete(conversation._id);
    }
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const m of members) await ctx.db.delete(m._id);
    await ctx.db.delete(args.groupId);
    await audit(ctx, me, "group.delete", {
      targetType: "group",
      targetId: args.groupId,
      summary: g.name,
    });
  },
});
