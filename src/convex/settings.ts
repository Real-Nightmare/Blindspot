import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireApproved, requireCreator, requirePermission, audit } from "./authz";

export type SiteFlags = {
  registrationOpen: boolean;
  uploadsEnabled: boolean;
  callsEnabled: boolean;
  globalChatEnabled: boolean;
  maintenanceMessage: string | null;
  retentionDays: number | null;
};

const DEFAULTS: SiteFlags = {
  registrationOpen: true,
  uploadsEnabled: true,
  callsEnabled: true,
  globalChatEnabled: true,
  maintenanceMessage: null,
  retentionDays: null,
};

export const getSiteFlags = query({
  args: {},
  handler: async (ctx): Promise<SiteFlags> => {
    const docs = await ctx.db.query("siteSettings").collect();
    const map = new Map(docs.map((d) => [d.key, d.value]));
    return {
      registrationOpen: map.has("registrationOpen") ? Boolean(map.get("registrationOpen")) : DEFAULTS.registrationOpen,
      uploadsEnabled: map.has("uploadsEnabled") ? Boolean(map.get("uploadsEnabled")) : DEFAULTS.uploadsEnabled,
      callsEnabled: map.has("callsEnabled") ? Boolean(map.get("callsEnabled")) : DEFAULTS.callsEnabled,
      globalChatEnabled: map.has("globalChatEnabled") ? Boolean(map.get("globalChatEnabled")) : DEFAULTS.globalChatEnabled,
      maintenanceMessage: (map.get("maintenanceMessage") as string | null) ?? null,
      retentionDays: (map.get("retentionDays") as number | null) ?? null,
    };
  },
});

/** Signed-out visitors need registration status for the wizard. */
export const publicGate = query({
  args: {},
  handler: async (ctx) => {
    const reg = await ctx.db
      .query("siteSettings")
      .withIndex("key", (q) => q.eq("key", "registrationOpen"))
      .first();
    return { registrationOpen: reg ? Boolean(reg.value) : true };
  },
});

export const setSiteFlag = mutation({
  args: {
    key: v.union(
      v.literal("registrationOpen"),
      v.literal("uploadsEnabled"),
      v.literal("callsEnabled"),
      v.literal("globalChatEnabled"),
      v.literal("maintenanceMessage"),
      v.literal("retentionDays"),
    ),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const profile = await requireCreator(ctx);
    const existing = await ctx.db
      .query("siteSettings")
      .withIndex("key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("siteSettings", { key: args.key, value: args.value });
    }
    await audit(ctx, profile, "settings.update", {
      targetType: "siteSetting",
      targetId: args.key,
      summary: `${args.key} = ${JSON.stringify(args.value)}`,
    });
  },
});

// --- Integration settings (creator-only; secrets masked on read) -------------

export const listIntegrations = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "integrations");
    const docs = await ctx.db.query("integrations").collect();
    return docs.map((d) => {
      const secrets = (d.secrets ?? {}) as Record<string, string>;
      const maskedSecrets = Object.fromEntries(
        Object.entries(secrets).map(([k, val]) => [
          k,
          val ? `${String(val).slice(0, 3)}••••${String(val).slice(-2)}` : "",
        ]),
      );
      return {
        _id: d._id,
        key: d.key,
        label: d.label,
        category: d.category,
        enabled: d.enabled,
        config: d.config ?? {},
        maskedSecrets,
        updatedAt: d.updatedAt,
      };
    });
  },
});

/** Save integration config + secrets. Secrets are stored server-side only. */
export const saveIntegration = mutation({
  args: {
    key: v.string(),
    label: v.string(),
    category: v.string(),
    enabled: v.boolean(),
    config: v.optional(v.any()),
    secrets: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const profile = await requireCreator(ctx);
    const normalized = args.key.trim().toLowerCase();
    const existing = await ctx.db
      .query("integrations")
      .withIndex("key", (q) => q.eq("key", normalized))
      .unique();
    const prevSecrets = existing ? ((existing.secrets ?? {}) as Record<string, string>) : {};
    const incoming = (args.secrets ?? {}) as Record<string, string>;
    // Masked values (containing ••••) mean "unchanged" — keep previous secret.
    const merged = Object.fromEntries(
      Object.entries(incoming).map(([k, val]) => [
        k,
        typeof val === "string" && val.includes("••••") ? prevSecrets[k] ?? "" : val,
      ]),
    );
    for (const [k, v] of Object.entries(prevSecrets)) {
      if (!(k in merged)) merged[k] = v;
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        label: args.label,
        category: args.category,
        enabled: args.enabled,
        config: args.config ?? existing.config,
        secrets: merged,
        updatedBy: profile._id,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("integrations", {
        key: normalized,
        label: args.label,
        category: args.category,
        enabled: args.enabled,
        config: args.config ?? {},
        secrets: merged,
        updatedBy: profile._id,
        updatedAt: Date.now(),
      });
    }
    await audit(ctx, profile, "integrations.save", {
      targetType: "integration",
      targetId: normalized,
    });
  },
});

/** Server-side accessor used by actions (AI builder, email, moderation APIs). */
export async function getIntegrationSecret(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { db: any },
  key: string,
): Promise<{ enabled: boolean; config: Record<string, unknown>; secrets: Record<string, string> } | null> {
  const doc = await ctx.db
    .query("integrations")
    .withIndex("key", (q: any) => q.eq("key", key))
    .unique();
  if (!doc) return null;
  return {
    enabled: doc.enabled,
    config: doc.config ?? {},
    secrets: doc.secrets ?? {},
  };
}
