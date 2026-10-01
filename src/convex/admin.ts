import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  requireApproved,
  requireCreator,
  requirePermission,
  requireVerificationAccess,
  isAdmin,
  isCreator,
  audit,
  ADMIN_PERMISSIONS,
  type Profile,
} from "./authz";
import { rateLimit } from "./rateLimit";
import { internal } from "./_generated/api";

// ------------------------------------------------------------------ audit ---

export const listAuditLogs = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "audit");
    return await ctx.db.query("auditLogs").withIndex("at").order("desc").take(300);
  },
});

// ---------------------------------------------------------------- overview ---

export const overviewStats = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "settings");
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const profiles = await ctx.db.query("profiles").collect();
    const apps = await ctx.db.query("applications").collect();
    const reports = await ctx.db.query("reports").collect();
    const groups = await ctx.db.query("groups").collect();
    const messages = await ctx.db.query("messages").collect();
    return {
      members: profiles.filter((p) => p.status === "approved").length,
      staff: profiles.filter((p) => isAdmin(p)).length,
      pending: apps.filter((a) => a.state === "pending" || a.state === "interview_requested" || a.state === "interview_submitted").length,
      suspended: profiles.filter((p) => p.status === "suspended" || p.status === "banned").length,
      openReports: reports.filter((r) => r.state === "open" || r.state === "reviewing").length,
      groups: groups.length,
      messages24h: messages.filter((m) => m._creationTime >= dayAgo).length,
      signups24h: profiles.filter((p) => p._creationTime >= dayAgo).length,
    };
  },
});

// ------------------------------------------------------------ applications ---

export const listApplications = query({
  args: { state: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "applications");
    const apps = await ctx.db.query("applications").order("desc").collect();
    const filtered = args.state ? apps.filter((a) => a.state === args.state) : apps;
    const results: {
      _id: Id<"applications">;
      state: Doc<"applications">["state"];
      createdAt: number;
      reviewedAt: number | null;
      rejectionReason: string | null;
      reviewNote: string | null;
      user: {
        _id: Id<"profiles">;
        username: string;
        fullName: string;
        email: string;
        status: Doc<"profiles">["status"];
        inviteCodeUsed: string | null;
        avatarStorageId: string | null;
      };
    }[] = [];
    for (const app of filtered.slice(0, 200)) {
      const user = await ctx.db.get(app.userId);
      if (!user) continue;
      results.push({
        _id: app._id,
        state: app.state,
        createdAt: app.createdAt,
        reviewedAt: app.reviewedAt ?? null,
        rejectionReason: app.rejectionReason ?? null,
        reviewNote: app.reviewNote ?? null,
        user: {
          _id: user._id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          status: user.status,
          inviteCodeUsed: user.inviteCodeUsed ?? null,
          avatarStorageId: user.avatarStorageId ?? null,
        },
      });
    }
    return results;
  },
});

function appStateChanged(appState: string, userStatus: string) {
  if (userStatus === "approved") return "approved";
  if (userStatus === "rejected") return "rejected";
  return appState;
}

export const reviewApplication = mutation({
  args: {
    applicationId: v.id("applications"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    note: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requirePermission(ctx, "applications");
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");
    const user = await ctx.db.get(app.userId);
    if (!user) throw new Error("User not found");
    const now = Date.now();
    if (args.decision === "approve") {
      await ctx.db.patch(user._id, { status: "approved" });
      await ctx.db.patch(app._id, {
        state: "approved",
        reviewedBy: admin._id,
        reviewedAt: now,
        reviewNote: args.note,
      });
      // Welcome notification
      await ctx.db.insert("notifications", {
        userId: user._id,
        kind: "approval",
        title: "Your application was approved",
        body: "Welcome to Blindspot. Sign in to enter.",
        link: "/app",
        read: false,
        createdAt: now,
      });
    } else {
      await ctx.db.patch(user._id, { status: "rejected", rejectionNote: args.note ?? args.reason });
      await ctx.db.patch(app._id, {
        state: "rejected",
        rejectionReason: args.reason ?? args.note ?? "Did not meet the bar",
        reviewedBy: admin._id,
        reviewedAt: now,
      });
    }
    await audit(ctx, admin, "applications.reviewed", {
      targetType: "application",
      targetId: app._id,
      summary: `${user.username}: ${args.decision}`,
    });
  },
});

export const requestInterview = mutation({
  args: { userId: v.id("profiles"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requirePermission(ctx, "applications");
    const now = Date.now();
    const existing = await ctx.db
      .query("verification")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();
    const interview = existing.find((v) => v.kind === "interview" && v.state !== "reviewed");
    if (interview) {
      await ctx.db.patch(interview._id, {
        note: args.note ?? interview.note,
        requestedBy: admin._id,
        requestedAt: now,
        state: "requested",
      });
    } else {
      await ctx.db.insert("verification", {
        userId: args.userId,
        kind: "interview",
        note: args.note,
        requestedBy: admin._id,
        requestedAt: now,
        state: "requested",
      });
    }
    const app = await ctx.db
      .query("applications")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .first();
    if (app) {
      await ctx.db.patch(app._id, { state: "interview_requested", updatedAt: now });
    }
    await ctx.db.insert("notifications", {
      userId: args.userId,
      kind: "moderation",
      title: "An interview was requested",
      body: "Visit the pending page to answer the creator's questions.",
      link: "/pending",
      read: false,
      createdAt: now,
    });
    await audit(ctx, admin, "verification.interviewRequested", {
      targetType: "profile",
      targetId: args.userId,
    });
  },
});

// ------------------------------------------------------------------- users ---

export const listUsers = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "users");
    const profiles = await ctx.db.query("profiles").collect();
    const q = (args.search ?? "").toLowerCase();
    return profiles
      .filter((p) => !args.status || p.status === args.status)
      .filter((p) => !q || p.username.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, args.limit ?? 200)
      .map((p) => ({
        _id: p._id,
        username: p.username,
        email: p.email,
        fullName: p.fullName,
        role: p.role,
        status: p.status,
        inviteCodeUsed: p.inviteCodeUsed ?? null,
        createdAt: p._creationTime,
        lastActiveAt: p.lastActiveAt ?? null,
      }));
  },
});

export const setUserStatus = mutation({
  args: {
    userId: v.id("profiles"),
    status: v.union(
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("suspended"),
      v.literal("banned"),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requirePermission(ctx, "users");
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role === "creator") throw new Error("The creator's status cannot be changed");
    await ctx.db.patch(args.userId, { status: args.status });
    const app = await ctx.db
      .query("applications")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .first();
    if (app) {
      await ctx.db.patch(app._id, {
        state: appStateChanged(app.state, args.status) as Doc<"applications">["state"],
        updatedAt: Date.now(),
      });
    }
    await audit(ctx, admin, "users.statusChanged", {
      targetType: "profile",
      targetId: args.userId,
      summary: `${user.username} → ${args.status}`,
    });
  },
});

// ----------------------------------------------------------------- admins ---

export const listAdmins = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "admins");
    const profiles = await ctx.db.query("profiles").collect();
    const staff = profiles.filter((p) => p.role === "admin" || p.role === "creator");
    const result: {
      _id: Id<"profiles">;
      username: string;
      email: string;
      role: Doc<"profiles">["role"];
      status: Doc<"profiles">["status"];
      permissions: string[];
      canVerification: boolean;
    }[] = [];
    for (const p of staff) {
      const grant = p.role === "creator"
        ? true
        : Boolean(
            await ctx.db
              .query("verificationAccess")
              .withIndex("adminUserId", (q) => q.eq("adminUserId", p._id))
              .first(),
          );
      result.push({
        _id: p._id,
        username: p.username,
        email: p.email,
        role: p.role,
        status: p.status,
        permissions: (p as Profile & { permissions?: string[] }).permissions ?? [],
        canVerification: grant,
      });
    }
    return result;
  },
});

export const createAdmin = mutation({
  args: {
    userId: v.id("profiles"),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const creator = await requireCreator(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.status !== "approved") throw new Error("Only approved members can become admins");
    await ctx.db.patch(user._id, {
      role: "admin",
      permissions: args.permissions ?? [],
    });
    await audit(ctx, creator, "admins.created", {
      targetType: "profile",
      targetId: user._id,
      summary: user.username,
    });
  },
});

export const updateAdminPermissions = mutation({
  args: {
    userId: v.id("profiles"),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const creator = await requireCreator(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "admin") throw new Error("Admin not found");
    for (const p of args.permissions) {
      if (!ADMIN_PERMISSIONS.includes(p as never)) throw new Error(`Unknown permission: ${p}`);
    }
    await ctx.db.patch(args.userId, { permissions: args.permissions });
    await audit(ctx, creator, "admins.permissionsUpdated", {
      targetType: "profile",
      targetId: args.userId,
      summary: `${user.username}: ${args.permissions.join(",") || "none"}`,
    });
  },
});

export const removeAdmin = mutation({
  args: { userId: v.id("profiles") },
  handler: async (ctx, args) => {
    const creator = await requireCreator(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "admin") throw new Error("Admin not found");
    await ctx.db.patch(args.userId, { role: "user", permissions: undefined });
    await ctx.db
      .query("verificationAccess")
      .withIndex("adminUserId", (q) => q.eq("adminUserId", args.userId))
      .collect()
      .then((grants) => Promise.all(grants.map((g) => ctx.db.delete(g._id))));
    await audit(ctx, creator, "admins.removed", {
      targetType: "profile",
      targetId: args.userId,
      summary: user.username,
    });
  },
});

// ------------------------------------------------- verification access gate ---

export const listVerificationAccess = query({
  args: {},
  handler: async (ctx) => {
    await requireCreator(ctx);
    const grants = await ctx.db.query("verificationAccess").collect();
    const result: {
      _id: Id<"verificationAccess">;
      adminUserId: Id<"profiles">;
      username: string;
      grantedAt: number;
    }[] = [];
    for (const g of grants) {
      const admin = await ctx.db.get(g.adminUserId);
      result.push({
        _id: g._id,
        adminUserId: g.adminUserId,
        username: admin?.username ?? "unknown",
        grantedAt: g.grantedAt,
      });
    }
    return result;
  },
});

export const grantVerificationAccess = mutation({
  args: { adminUserId: v.id("profiles") },
  handler: async (ctx, args) => {
    const creator = await requireCreator(ctx);
    const admin = await ctx.db.get(args.adminUserId);
    if (!admin || admin.role !== "admin") throw new Error("Grant verification access to admins only");
    const existing = await ctx.db
      .query("verificationAccess")
      .withIndex("adminUserId", (q) => q.eq("adminUserId", args.adminUserId))
      .first();
    if (existing) return;
    await ctx.db.insert("verificationAccess", {
      adminUserId: args.adminUserId,
      grantedBy: creator._id,
      grantedAt: Date.now(),
    });
    await audit(ctx, creator, "verification.accessGranted", {
      targetType: "profile",
      targetId: args.adminUserId,
      summary: admin.username,
    });
  },
});

export const revokeVerificationAccess = mutation({
  args: { adminUserId: v.id("profiles") },
  handler: async (ctx, args) => {
    const creator = await requireCreator(ctx);
    const grants = await ctx.db
      .query("verificationAccess")
      .withIndex("adminUserId", (q) => q.eq("adminUserId", args.adminUserId))
      .collect();
    for (const g of grants) await ctx.db.delete(g._id);
    await audit(ctx, creator, "verification.accessRevoked", {
      targetType: "profile",
      targetId: args.adminUserId,
    });
  },
});

// ------------------------------------------------------------- verification ---

export const myVerificationRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireApproved(ctx);
    const docs = await ctx.db
      .query("verification")
      .withIndex("userId", (q) => q.eq("userId", me._id))
      .collect();
    return docs
      .filter((d) => d.state !== "reviewed")
      .sort((a, b) => (b.requestedAt ?? 0) - (a.requestedAt ?? 0))
      .map((d) => ({
        _id: d._id,
        kind: d.kind,
        note: d.note ?? null,
        state: d.state,
        requestedAt: d.requestedAt ?? null,
      }));
  },
});

export const submitInterview = mutation({
  args: {
    verificationId: v.id("verification"),
    answers: v.string(),
    fileIds: v.optional(v.array(v.id("_storage"))),
    fileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const doc = await ctx.db.get(args.verificationId);
    if (!doc || doc.userId !== me._id) throw new Error("Not found");
    if (doc.state === "reviewed") throw new Error("Already reviewed");
    if (args.answers.trim().length < 10) throw new Error("Write a little more");
    await ctx.db.patch(args.verificationId, {
      answers: args.answers.trim(),
      fileIds: args.fileIds ?? doc.fileIds,
      fileName: args.fileName ?? doc.fileName,
      submittedAt: Date.now(),
      state: "submitted",
    });
    const app = await ctx.db
      .query("applications")
      .withIndex("userId", (q) => q.eq("userId", me._id))
      .first();
    if (app) {
      await ctx.db.patch(app._id, { state: "interview_submitted", updatedAt: Date.now() });
    }
  },
});

/** Staff view — guarded by requireVerificationAccess. */
export const listVerification = query({
  args: {},
  handler: async (ctx) => {
    await requireVerificationAccess(ctx);
    const docs = await ctx.db.query("verification").order("desc").take(200);
    const results: (Doc<"verification"> & { username: string; email: string | null })[] = [];
    for (const d of docs) {
      const user = await ctx.db.get(d.userId);
      results.push({
        ...d,
        username: user?.username ?? "unknown",
        email: user?.email ?? null,
      });
    }
    return results;
  },
});

/** Mark verification reviewed; creator can also delete sensitive material. */
export const markVerificationReviewed = mutation({
  args: { verificationId: v.id("verification") },
  handler: async (ctx, args) => {
    const admin = await requireVerificationAccess(ctx);
    const doc = await ctx.db.get(args.verificationId);
    if (!doc) throw new Error("Not found");
    await ctx.db.patch(args.verificationId, {
      state: "reviewed",
      reviewedBy: admin._id,
      reviewedAt: Date.now(),
    });
    await audit(ctx, admin, "verification.reviewed", {
      targetType: "verification",
      targetId: args.verificationId,
    });
  },
});

export const deleteVerificationData = mutation({
  args: { verificationId: v.id("verification") },
  handler: async (ctx, args) => {
    const creator = await requireCreator(ctx);
    const doc = await ctx.db.get(args.verificationId);
    if (!doc) throw new Error("Not found");
    for (const f of doc.fileIds ?? []) {
      await ctx.storage.delete(f).catch(() => {});
    }
    await ctx.db.delete(args.verificationId);
    await audit(ctx, creator, "verification.deleted", {
      targetType: "verification",
      targetId: args.verificationId,
      summary: doc.userId,
    });
  },
});

/**
 * Creator-only: permanently delete EVERY account (Better Auth user + Blindspot
 * profile and all owned rows). Intended for wiping test data before go-live.
 * The calling creator account is deleted too — the next registration after
 * this becomes the new creator.
 */
export const wipeAllAccounts = action({
  args: {},
  handler: async (ctx): Promise<{ deleted: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const caller: { role: string } | null = await ctx.runQuery(
      internal.exports.myProfileInternal,
      { subject: identity.subject },
    );
    // Allow when called by the creator OR when the database has no profiles
    // left at all (bootstrap/recovery wipe after a partial cleanup).
    const profileCount: number = await ctx.runQuery(internal.adminInternal.countProfiles, {});
    const isCreatorCaller = caller?.role === "creator";
    const isEmptyDb = profileCount === 0;
    if (!isCreatorCaller && !isEmptyDb) {
      throw new Error("Creator access required");
    }

    const users: { id: string }[] = await ctx.runQuery(
      internal.adminInternal.allAuthUserIds,
      {},
    );
    let deleted = 0;
    for (const u of users) {
      try {
        await ctx.runMutation(internal.adminInternal.deleteAuthUser, {
          userId: u.id,
        });
        deleted++;
      } catch {
        // continue with the rest
      }
    }

    await ctx.runMutation(internal.adminInternal.wipeAuthSessions, {});
    const removedProfiles: number = await ctx.runMutation(
      internal.adminInternal.wipeProfiles,
      {},
    );

    return { deleted: deleted + removedProfiles };
  },
});
