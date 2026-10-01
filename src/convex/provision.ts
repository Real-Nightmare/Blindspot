import { internalMutation, mutation, query } from "./_generated/server";
import type { GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

/**
 * Creator election.
 *
 * Invariant: at most one profile with role "creator" may exist, and a
 * profile is only promoted at the moment its status becomes "approved".
 *
 * Convex mutations are serializable: concurrent registrations commit one at
 * a time, so the existence check below cannot interleave with another
 * transaction's insert. Two simultaneous signups therefore cannot both win —
 * the loser stays "pending" and enters the approval queue.
 */
export async function ensureCreator(
  ctx: GenericMutationCtx<any>,
  profileId: any,
): Promise<"promoted" | "pending"> {
  const creator = await ctx.db
    .query("profiles")
    .withIndex("role", (q: any) => q.eq("role", "creator"))
    .first();
  if (creator) {
    return creator._id === profileId ? "promoted" : "pending";
  }
  const profile: Doc<"profiles"> | null = await ctx.db.get(profileId);
  if (!profile) throw new Error("Profile missing");
  await ctx.db.patch(profile._id, { role: "creator", status: "approved" });
  await ctx.db.insert("auditLogs", {
    actorId: profile._id,
    actorLabel: profile.username,
    action: "creator.elected",
    targetType: "profile",
    targetId: profile._id,
    summary: "First account became the Creator",
    at: Date.now(),
  });
  return "promoted";
}

export async function currentRulesVersion(ctx: GenericMutationCtx<any>): Promise<number> {
  const doc = await ctx.db
    .query("siteSettings")
    .withIndex("key", (q: any) => q.eq("key", "rulesVersion"))
    .first();
  return typeof doc?.value === "number" ? doc.value : 1;
}

export const registerProfile = internalMutation({
  args: {
    authUserId: v.string(),
    email: v.string(),
    fullName: v.string(),
    username: v.string(),
    inviteCode: v.string(),
    acceptedRulesVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const username = args.username.trim();
    const fullName = args.fullName.trim();
    if (!USERNAME_RE.test(username)) {
      throw new Error("Username must be 3-24 letters, numbers or underscores");
    }
    if (fullName.length < 2 || fullName.length > 80) {
      throw new Error("Enter your full name");
    }

    const existingByAuth = await ctx.db
      .query("profiles")
      .withIndex("authUserId", (q) => q.eq("authUserId", args.authUserId))
      .unique();
    if (existingByAuth) {
      return { profileId: existingByAuth._id, outcome: "existing" as const };
    }

    const existingByUsername = await ctx.db
      .query("profiles")
      .withIndex("username", (q) => q.eq("username", username))
      .first();
    if (existingByUsername) {
      throw new Error("That username is taken");
    }

    // Invite gate: if any creator exists, a valid active invite code is
    // required. The initial "NIGHT" code is seeded lazily on first use.
    const anyCreator = await ctx.db
      .query("profiles")
      .withIndex("role", (q) => q.eq("role", "creator"))
      .first();

    if (!anyCreator) {
      const seeded = await ctx.db
        .query("inviteCodes")
        .withIndex("code", (q) => q.eq("code", "NIGHT"))
        .first();
      if (!seeded) {
        await ctx.db.insert("inviteCodes", {
          code: "NIGHT",
          active: true,
          uses: 0,
          note: "Initial access code",
        });
      }
    }

    const code = args.inviteCode.trim().toUpperCase();
    const invite = await ctx.db
      .query("inviteCodes")
      .withIndex("code", (q) => q.eq("code", code))
      .unique();
    if (!invite || !invite.active) {
      throw new Error("Invalid or inactive access code");
    }

    // Rules acceptance must match the current published version.
    const rulesVersion = await currentRulesVersion(ctx);
    if (args.acceptedRulesVersion < rulesVersion) {
      throw new Error("The rules changed — please accept the current version");
    }

    const profileId = await ctx.db.insert("profiles", {
      authUserId: args.authUserId,
      email: args.email,
      fullName, // private verification info — never rendered publicly
      username,
      role: "user",
      status: "pending",
      inviteCodeUsed: code,
      acceptedRulesVersion: args.acceptedRulesVersion,
      acceptedRulesAt: Date.now(),
      notifyMessages: true,
      notifyMentions: true,
      notifyCalls: true,
      notifyGroups: true,
      notifyApprovals: true,
      notifyModeration: true,
      allowDmFrom: "everyone",
      allowGroupInvites: true,
      showOnline: true,
      showLastActive: false,
      showReadReceipts: true,
      showTyping: true,
      discoverable: true,
      quietMode: false,
    });

    await ctx.db.insert("ruleAcceptances", {
      userId: profileId,
      version: args.acceptedRulesVersion,
      acceptedAt: Date.now(),
    });

    await ctx.db.insert("applications", {
      userId: profileId,
      state: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.patch(invite._id, {
      uses: invite.uses + 1,
      lastUsedAt: Date.now(),
    });

    await ctx.db.insert("inviteAudit", {
      code,
      usedByProfile: profileId,
      usedByEmail: args.email,
      action: "consume",
      at: Date.now(),
    });

    // Creator election — the first ever account is approved immediately.
    const outcome = await ensureCreator(ctx, profileId);
    if (outcome === "promoted") {
      const app = await ctx.db
        .query("applications")
        .withIndex("userId", (q) => q.eq("userId", profileId))
        .first();
      if (app) {
        await ctx.db.patch(app._id, {
          state: "approved",
          reviewedAt: Date.now(),
        });
      }
    }

    return { profileId, outcome };
  },
});

export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    let profile: Doc<"profiles"> | null = await ctx.db
      .query("profiles")
      .withIndex("authUserId", (q) => q.eq("authUserId", identity.subject))
      .unique();
    if (!profile && identity.email) {
      profile =
        (await ctx.db
          .query("profiles")
          .withIndex("email", (q) => q.eq("email", identity.email!))
          .first()) ?? null;
    }
    return profile ?? null;
  },
});

export const touchLastActive = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("authUserId", (q) => q.eq("authUserId", identity.subject))
      .unique();
    if (profile) {
      await ctx.db.patch(profile._id, { lastActiveAt: Date.now() });
    }
  },
});

// Used by the admin modules to bump the global rules version atomically.
export const bumpRulesVersion = internalMutation({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query("siteSettings")
      .withIndex("key", (q) => q.eq("key", "rulesVersion"))
      .first();
    const next = (typeof doc?.value === "number" ? doc.value : 1) + 1;
    if (doc) {
      await ctx.db.patch(doc._id, { value: next });
    } else {
      await ctx.db.insert("siteSettings", { key: "rulesVersion", value: next });
    }
    return next;
  },
});
