import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireProfile, isCreator, audit } from "./authz";
import { rateLimit } from "./rateLimit";

/** Public: which step of the journey applies to this visitor? */
export const gateStatus = query({
  args: {},
  handler: async (ctx) => {
    const creator = await ctx.db
      .query("profiles")
      .withIndex("role", (q) => q.eq("role", "creator"))
      .first();
    const creatorExists = Boolean(creator);
    const rules = await ctx.db
      .query("rules")
      .withIndex("published", (q) => q.eq("published", true))
      .collect();
    const published = rules
      .filter((r) => !r.disabled)
      .sort((a, b) => a.order - b.order)
      .map((r) => ({
        order: r.order,
        title: r.title,
        body: r.body,
        version: r.order,
      }));
    const rulesVersion = published.length
      ? Math.max(...published.map((r) => r.version)) + 1
      : 1;
    return { creatorExists, rules: published, rulesVersion };
  },
});

/**
 * Validate an access code before registration. Rate limited per profile
 * (only signed-in users reach this) and never reveals whether a code exists.
 */
export const validateAccessCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    await rateLimit(ctx, "validateCode", profile._id, { max: 10, windowMs: 60_000 });
    const code = args.code.trim().toUpperCase();
    const invite = await ctx.db
      .query("inviteCodes")
      .withIndex("code", (q) => q.eq("code", code))
      .unique();
    const ok = Boolean(invite?.active);
    await ctx.db.insert("inviteAudit", {
      code,
      usedByProfile: profile._id,
      usedByEmail: profile.email,
      action: "validate",
      at: Date.now(),
    });
    return { ok };
  },
});

/** Creators manage invite codes; audit trail records every usage. */
export const listInviteCodes = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    if (!isCreator(profile)) throw new Error("Creator access required");
    const codes = await ctx.db.query("inviteCodes").collect();
    return codes.sort((a, b) => b.uses - a.uses);
  },
});

export const upsertInviteCode = mutation({
  args: {
    code: v.string(),
    active: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    if (!isCreator(profile)) throw new Error("Creator access required");
    const normalized = args.code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,32}$/.test(normalized)) {
      throw new Error("Codes are 3-32 characters: letters, numbers, dashes");
    }
    const existing = await ctx.db
      .query("inviteCodes")
      .withIndex("code", (q) => q.eq("code", normalized))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { active: args.active, note: args.note });
    } else {
      await ctx.db.insert("inviteCodes", {
        code: normalized,
        active: args.active,
        uses: 0,
        note: args.note,
      });
    }
    await audit(ctx, profile, "invite.upsert", {
      targetType: "inviteCode",
      targetId: normalized,
      summary: `Set code ${normalized} active=${args.active}`,
    });
  },
});

export const inviteAuditTrail = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    if (!isCreator(profile)) throw new Error("Creator access required");
    return await ctx.db.query("inviteAudit").order("desc").take(100);
  },
});

// --- Secure creator recovery -------------------------------------------------

const simpleHash = (s: string): string => {
  // Deterministic non-cryptographic marker hash; recovery codes are random
  // 24-char strings, so this is sufficient to avoid storing plaintext while
  // staying dependency-free. Not used for passwords.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}-${s.length}`;
};

export const generateRecoveryCodes = mutation({
  args: {},
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    if (!isCreator(profile)) throw new Error("Creator access required");
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const codes: string[] = [];
    for (let i = 0; i < 4; i++) {
      let c = "";
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      for (const b of bytes) c += alphabet[b % alphabet.length];
      codes.push(c);
      await ctx.db.insert("recoveryCodes", {
        userId: profile._id,
        codeHash: simpleHash(c),
        used: false,
        createdAt: Date.now(),
      });
    }
    await audit(ctx, profile, "recovery.generated", {
      targetType: "profile",
      targetId: profile._id,
      summary: "Generated new creator recovery codes",
    });
    return codes; // shown exactly once
  },
});

export const redeemRecoveryCode = mutation({
  args: { authUserId: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    await rateLimit(ctx, "recovery", args.authUserId, { max: 5, windowMs: 300_000 });
    const profile = await ctx.db
      .query("profiles")
      .withIndex("authUserId", (q) => q.eq("authUserId", args.authUserId))
      .unique();
    if (!profile) throw new Error("Account not found");
    const codes = await ctx.db
      .query("recoveryCodes")
      .withIndex("userId", (q) => q.eq("userId", profile._id))
      .collect();
    const match = codes.find((c) => !c.used && c.codeHash === simpleHash(args.code.trim()));
    if (!match) throw new Error("Invalid recovery code");
    await ctx.db.patch(match._id, { used: true });
    await ctx.db.patch(profile._id, { status: "approved" });
    await audit(ctx, profile, "recovery.redeemed", {
      targetType: "profile",
      targetId: profile._id,
    });
    return { ok: true };
  },
});
