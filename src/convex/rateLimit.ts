import type { GenericMutationCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";

type MutCtx = GenericMutationCtx<DataModel>;

/**
 * Fixed-window rate limiter backed by the rateLimits table. Used to slow
 * brute-force-style abuse of sensitive operations (invite validation,
 * report spam, message floods). Intentionally simple and dependency-free.
 */
export async function rateLimit(
  ctx: MutCtx,
  name: string,
  key: string,
  opts: { max: number; windowMs: number },
): Promise<void> {
  const now = Date.now();
  const doc = await ctx.db
    .query("rateLimits")
    .withIndex("name_key", (q) => q.eq("name", name).eq("key", key))
    .first();
  if (!doc) {
    await ctx.db.insert("rateLimits", { name, key, value: 1, ts: now });
    return;
  }
  if (now - doc.ts > opts.windowMs) {
    await ctx.db.patch(doc._id, { value: 1, ts: now });
    return;
  }
  if (doc.value >= opts.max) {
    throw new Error("Too many attempts — try again shortly");
  }
  await ctx.db.patch(doc._id, { value: doc.value + 1 });
}
