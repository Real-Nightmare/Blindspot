import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireApproved, requireProfile, requirePermission, audit, isBlockedBetween } from "./authz";
import { rateLimit } from "./rateLimit";

// ----------------------------------------------------------------- reports ---

export const fileReport = mutation({
  args: {
    targetType: v.union(
      v.literal("user"),
      v.literal("message"),
      v.literal("file"),
      v.literal("group"),
    ),
    targetId: v.string(),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    await rateLimit(ctx, "report", me._id, { max: 20, windowMs: 3600_000 });
    if (args.reason.trim().length < 3) throw new Error("Describe the reason");
    if (args.details && args.details.length > 2000) throw new Error("Details too long");
    await ctx.db.insert("reports", {
      reporterId: me._id,
      targetType: args.targetType,
      targetId: args.targetId,
      reason: args.reason.trim(),
      details: args.details?.trim(),
      state: "open",
      createdAt: Date.now(),
    });
  },
});

export const listMyReports = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireApproved(ctx);
    return await ctx.db
      .query("reports")
      .withIndex("reporterId", (q) => q.eq("reporterId", me._id))
      .order("desc")
      .take(50);
  },
});

export const adminListReports = query({
  args: { state: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "reports");
    let reports: Doc<"reports">[];
    if (args.state) {
      reports = await ctx.db
        .query("reports")
        .withIndex("state", (q) => q.eq("state", args.state as "open"))
        .take(200);
    } else {
      reports = await ctx.db.query("reports").order("desc").take(200);
    }
    const result: (Doc<"reports"> & {
      reporterUsername: string;
    })[] = [];
    for (const r of reports) {
      const reporter = await ctx.db.get(r.reporterId);
      result.push({
        ...r,
        reporterUsername: reporter?.username ?? "unknown",
      });
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const updateReportState = mutation({
  args: {
    reportId: v.id("reports"),
    state: v.union(
      v.literal("reviewing"),
      v.literal("resolved"),
      v.literal("dismissed"),
    ),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requirePermission(ctx, "reports");
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error("Report not found");
    await ctx.db.patch(args.reportId, {
      state: args.state,
      handledBy: me._id,
      handledAt: Date.now(),
      resolution: args.resolution,
    });
    await audit(ctx, me, `report.${args.state}`, {
      targetType: "report",
      targetId: args.reportId,
      summary: report.reason,
    });
  },
});

// ---------------------------------------------------------------- blocking ---

export const blockUser = mutation({
  args: { userId: v.id("profiles") },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    if (me._id === args.userId) throw new Error("Cannot block yourself");
    const existing = await ctx.db
      .query("blocks")
      .withIndex("blockerId_blockedId", (q) =>
        q.eq("blockerId", me._id).eq("blockedId", args.userId),
      )
      .first();
    if (existing) return;
    await ctx.db.insert("blocks", {
      blockerId: me._id,
      blockedId: args.userId,
      createdAt: Date.now(),
    });
  },
});

export const unblockUser = mutation({
  args: { userId: v.id("profiles") },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const existing = await ctx.db
      .query("blocks")
      .withIndex("blockerId_blockedId", (q) =>
        q.eq("blockerId", me._id).eq("blockedId", args.userId),
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const listBlocked = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireProfile(ctx);
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("blockerId", (q) => q.eq("blockerId", me._id))
      .collect();
    const result: {
      blockedId: Id<"profiles">;
      username: string;
      createdAt: number;
    }[] = [];
    for (const b of blocks) {
      const p = await ctx.db.get(b.blockedId);
      result.push({
        blockedId: b.blockedId,
        username: p?.username ?? "unknown",
        createdAt: b.createdAt,
      });
    }
    return result;
  },
});

export const amIBlockedWith = query({
  args: { otherUserId: v.id("profiles") },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx);
    return await isBlockedBetween(ctx, me._id, args.otherUserId);
  },
});

// ----------------------------------------------------------- notifications ---

export const listNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx);
    const docs = await ctx.db
      .query("notifications")
      .withIndex("userId", (q) => q.eq("userId", me._id))
      .order("desc")
      .take(args.limit ?? 30);
    return docs;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireProfile(ctx);
    const docs = await ctx.db
      .query("notifications")
      .withIndex("userId_read", (q) => q.eq("userId", me._id).eq("read", false))
      .take(99);
    return docs.length;
  },
});

export const markNotificationRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx);
    const doc = await ctx.db.get(args.notificationId);
    if (!doc) throw new Error("Not found");
    if (doc.userId !== me._id) throw new Error("Not authorized");
    await ctx.db.patch(args.notificationId, { read: true });
  },
});

export const markAllNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireProfile(ctx);
    const docs = await ctx.db
      .query("notifications")
      .withIndex("userId_read", (q) => q.eq("userId", me._id).eq("read", false))
      .collect();
    for (const d of docs) await ctx.db.patch(d._id, { read: true });
  },
});

// -------------------------------------------------------- trusted contacts ---

export const listTrustedContacts = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireApproved(ctx);
    const rows = await ctx.db
      .query("trustedContacts")
      .withIndex("userId", (q) => q.eq("userId", me._id))
      .collect();
    const result: {
      contactId: Id<"profiles">;
      username: string;
      createdAt: number;
    }[] = [];
    for (const r of rows) {
      const p = await ctx.db.get(r.contactId);
      result.push({
        contactId: r.contactId,
        username: p?.username ?? "unknown",
        createdAt: r.createdAt,
      });
    }
    return result;
  },
});

export const addTrustedContact = mutation({
  args: { contactId: v.id("profiles") },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    if (me._id === args.contactId) throw new Error("Cannot add yourself");
    const existing = await ctx.db
      .query("trustedContacts")
      .withIndex("userId_contactId", (q) =>
        q.eq("userId", me._id).eq("contactId", args.contactId),
      )
      .first();
    if (existing) return;
    await ctx.db.insert("trustedContacts", {
      userId: me._id,
      contactId: args.contactId,
      createdAt: Date.now(),
    });
  },
});

export const removeTrustedContact = mutation({
  args: { contactId: v.id("profiles") },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const existing = await ctx.db
      .query("trustedContacts")
      .withIndex("userId_contactId", (q) =>
        q.eq("userId", me._id).eq("contactId", args.contactId),
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});
