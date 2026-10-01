import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { components } from "./_generated/api";

/**
 * Internal helpers backing admin.wipeAllAccounts. The Better Auth component
 * stores users/sessions/accounts in its own tables; they are addressable
 * through its exposed adapter api (components.betterAuth.adapter).
 */

/** Count remaining Blindspot profiles (bootstrap-wipe gate). */
export const countProfiles = internalQuery({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("profiles").collect();
    return docs.length;
  },
});

/** All Better Auth user ids from the component's user table. */
export const allAuthUserIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (components.betterAuth as any).adapter.findMany,
      {
        model: "user",
        paginationOpts: { numItems: 1000, cursor: null },
      },
    ) as { page: { _id: string }[] };
    void users;
    // The raw api returns a paginated result already resolved by the adapter;
    // shape depends on component version, so normalize defensively.
    const list = Array.isArray(users) ? (users as unknown as { _id: string }[]) : (users.page ?? []);
    return list.map((u) => ({ id: String(u._id) }));
  },
});

/** Delete one Better Auth user (sessions/accounts cascade in the component). */
export const deleteAuthUser = internalMutation({
  args: { userId: v.string() },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<void> => {
    await ctx.runMutation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (components.betterAuth as any).adapter.deleteOne,
      {
        input: {
          model: "user",
          where: [{ field: "_id", operator: "eq", value: args.userId }],
        },
      },
    );
  },
});

/** Delete every Better Auth session and account row (covers orphaned users). */
export const wipeAuthSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    let total = 0;
    for (const model of ["session", "account", "verification"] as const) {
      // Delete in pages until empty.
      for (let round = 0; round < 50; round++) {
        const res = (await ctx.runMutation(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (components.betterAuth as any).adapter.deleteMany,
          {
            input: { model },
            paginationOpts: { numItems: 500, cursor: null },
          },
        )) as { count?: number } | number | null;
        const count = typeof res === "number" ? res : (res?.count ?? 0);
        total += count;
        if (count < 500) break;
      }
    }
    return total;
  },
});

const APP_TABLES = [
  "applications",
  "reactions",
  "typing",
  "notifications",
  "blocks",
  "trustedContacts",
  "ruleAcceptances",
  "recoveryCodes",
  "verificationAccess",
  "inviteAudit",
  "conversationMembers",
  "groupMembers",
  "messages",
  "conversations",
  "groups",
  "files",
  "verification",
  "reports",
  "calls",
  "aiBuilderRuns",
  "inviteCodes",
  "auditLogs",
  "rateLimits",
] as const;

/** Delete every Blindspot profile plus all app rows. */
export const wipeProfiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    let removed = 0;
    const profiles = await ctx.db.query("profiles").collect();
    for (const p of profiles) {
      await ctx.db.delete(p._id);
      removed++;
    }
    for (const table of APP_TABLES) {
      const docs = await ctx.db.query(table).collect();
      for (const d of docs) {
        await ctx.db.delete(d._id);
      }
    }
    return removed;
  },
});
