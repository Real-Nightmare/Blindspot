import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireApproved, requireCreator, requirePermission, audit } from "./authz";

// Starter rules shown before the first account exists. The creator rewrites
// them in /admin → Rules; editing there keeps working as normal.
const SEED_RULES: { title: string; body: string }[] = [
  {
    title: "Privacy is the promise",
    body:
      "What happens here stays here. Never screenshot, copy, or repost another member's words, photos, or files outside Blindspot — not to friends, not to other platforms, not "
      + "anywhere.",
  },
  {
    title: "Consent before contact",
    body:
      "Ask before DMing someone cold, before adding anyone to a group, and before sharing anything personal about them. If someone disengages, leave it there.",
  },
  {
    title: "No leaks, no surveillance",
    body:
      "No scraping, logging, tracking, or collecting information about members. No joining under false pretenses to monitor or expose anyone. Full names and verification materials are private — treat them as sealed.",
  },
  {
    title: "Treat people as people",
    body:
      "Harassment, threats, hate, and targeted cruelty end in removal. Disagree with ideas, not with existence. Assume good faith first, and take conflict to private conversation rather than public pile-ons.",
  },
  {
    title: "Keep the room quiet enough to hear",
    body:
      "No spam, no self-promotion without being asked, no flooding. Share files and media you have the right to share. Disappearing messages are a courtesy — don't rely on them to hide harm.",
  },
  {
    title: "The door works both ways",
    body:
      "You were let in by someone who vouched for this space. Report anything that feels wrong to the creator. Members who break the trust lose their access; serious violations end in a ban.",
  },
];

/**
 * One-time bootstrap: insert the starter rules when the community has no
 * rules yet. Guarded on zero profiles so it can only ever run for an empty,
 * pre-launch deployment — once the first (creator) account exists, this
 * refuses and rule changes happen exclusively through /admin → Rules.
 */
export const seedStarterRules = mutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("profiles").first();
    if (profiles) {
      throw new Error("Community already exists — rules are managed in the admin panel");
    }
    const existing = await ctx.db.query("rules").collect();
    if (existing.length > 0) {
      return { seeded: 0 };
    }
    for (let i = 0; i < SEED_RULES.length; i++) {
      await ctx.db.insert("rules", {
        order: i + 1,
        title: SEED_RULES[i].title,
        body: SEED_RULES[i].body,
        published: true,
        disabled: false,
      });
    }
    await ctx.db.insert("auditLogs", {
      actorLabel: "system",
      action: "rules.seeded",
      summary: `Seeded ${SEED_RULES.length} starter rules before launch`,
      at: Date.now(),
    });
    return { seeded: SEED_RULES.length };
  },
});

/** Published rules, in order — readable by everyone (shown pre-signup). */
export const publishedRules = query({
  args: {},
  handler: async (ctx) => {
    const rules = await ctx.db
      .query("rules")
      .withIndex("published", (q) => q.eq("published", true))
      .collect();
    return rules
      .filter((r) => !r.disabled)
      .sort((a, b) => a.order - b.order)
      .map((r) => ({ order: r.order, title: r.title, body: r.body, version: r.order }));
  },
});

export const currentVersion = query({
  args: {},
  handler: async (ctx) => {
    const rules = await ctx.db
      .query("rules")
      .withIndex("published", (q) => q.eq("published", true))
      .collect();
    const active = rules.filter((r) => !r.disabled);
    return active.length ? Math.max(...active.map((r) => r.order)) + 1 : 1;
  },
});

// --- Creator rule management (versioned) -------------------------------------

export const allRules = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "rules");
    const rules = await ctx.db.query("rules").collect();
    return rules.sort((a, b) => a.order - b.order);
  },
});

export const ruleVersions = query({
  args: { ruleId: v.id("rules") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "rules");
    const versions = await ctx.db
      .query("ruleVersions")
      .withIndex("ruleId", (q) => q.eq("ruleId", args.ruleId))
      .collect();
    return versions.sort((a, b) => b.version - a.version);
  },
});

export const saveRule = mutation({
  args: {
    ruleId: v.optional(v.id("rules")),
    title: v.string(),
    body: v.string(),
    order: v.number(),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    const profile = await requireCreator(ctx);
    if (args.title.trim().length < 3) throw new Error("Title is too short");
    if (args.body.trim().length < 3) throw new Error("Body is too short");
    const now = Date.now();
    let ruleId = args.ruleId;
    if (ruleId) {
      const existing = await ctx.db.get(ruleId);
      if (!existing) throw new Error("Rule not found");
      const versions = await ctx.db
        .query("ruleVersions")
        .withIndex("ruleId", (q) => q.eq("ruleId", ruleId!))
        .collect();
      await ctx.db.patch(ruleId, {
        title: args.title.trim(),
        body: args.body.trim(),
        order: args.order,
        published: args.published,
        updatedBy: profile._id,
      });
      await ctx.db.insert("ruleVersions", {
        ruleId,
        version: versions.length + 1,
        title: args.title.trim(),
        body: args.body.trim(),
        order: args.order,
        published: args.published,
        savedBy: profile._id,
        savedAt: now,
      });
    } else {
      ruleId = await ctx.db.insert("rules", {
        title: args.title.trim(),
        body: args.body.trim(),
        order: args.order,
        published: args.published,
        disabled: false,
        updatedBy: profile._id,
      });
      await ctx.db.insert("ruleVersions", {
        ruleId,
        version: 1,
        title: args.title.trim(),
        body: args.body.trim(),
        order: args.order,
        published: args.published,
        savedBy: profile._id,
        savedAt: now,
      });
    }
    await audit(ctx, profile, "rules.save", {
      targetType: "rule",
      targetId: ruleId,
      summary: args.title,
    });
    return ruleId;
  },
});

export const setRuleDisabled = mutation({
  args: { ruleId: v.id("rules"), disabled: v.boolean() },
  handler: async (ctx, args) => {
    const profile = await requireCreator(ctx);
    await ctx.db.patch(args.ruleId, { disabled: args.disabled });
    await audit(ctx, profile, args.disabled ? "rules.disable" : "rules.enable", {
      targetType: "rule",
      targetId: args.ruleId,
    });
  },
});

export const reorderRules = mutation({
  args: { orderedIds: v.array(v.id("rules")) },
  handler: async (ctx, args) => {
    const profile = await requireCreator(ctx);
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { order: i + 1 });
    }
    await audit(ctx, profile, "rules.reorder", { summary: `${args.orderedIds.length} rules` });
  },
});

export const deleteRule = mutation({
  args: { ruleId: v.id("rules") },
  handler: async (ctx, args) => {
    const profile = await requireCreator(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Rule not found");
    await ctx.db.delete(args.ruleId);
    const versions = await ctx.db
      .query("ruleVersions")
      .withIndex("ruleId", (q) => q.eq("ruleId", args.ruleId))
      .collect();
    for (const v of versions) await ctx.db.delete(v._id);
    await audit(ctx, profile, "rules.delete", {
      targetType: "rule",
      targetId: args.ruleId,
      summary: rule.title,
    });
  },
});
