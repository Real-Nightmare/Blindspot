import type { GenericQueryCtx, GenericMutationCtx, GenericActionCtx } from "convex/server";
import type { DataModel, Doc, Id } from "./_generated/dataModel";

export type Profile = Doc<"profiles">;
export type ProfileId = Id<"profiles">;

type AnyCtx =
  | GenericQueryCtx<DataModel>
  | GenericMutationCtx<DataModel>
  | GenericActionCtx<DataModel>;

type DbCtx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

export function hasDb(ctx: AnyCtx): ctx is DbCtx {
  return "db" in ctx && typeof (ctx as DbCtx).db?.get === "function";
}

/** Resolve the authenticated profile in a query/mutation ctx or throw. */
export async function lookupProfileByIdentity(
  ctx: DbCtx,
  identity: { subject: string; email?: string | null | undefined },
): Promise<Profile> {
  let profile = await ctx.db
    .query("profiles")
    .withIndex("authUserId", (q) => q.eq("authUserId", identity.subject))
    .unique();
  if (!profile && identity.email) {
    profile = await ctx.db
      .query("profiles")
      .withIndex("email", (q) => q.eq("email", identity.email!))
      .first();
  }
  if (!profile) throw new Error("Account not found");
  return profile;
}

/** Every flow starts here: resolve the authenticated profile or throw. */
export async function requireProfile(ctx: AnyCtx): Promise<Profile> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  if (!hasDb(ctx)) {
    throw new Error("Profile lookup requires a query or mutation context");
  }
  return lookupProfileByIdentity(ctx, identity);
}

/** Approved members only (creator/admin/user with active status). */
export async function requireApproved(ctx: AnyCtx): Promise<Profile> {
  const profile = await requireProfile(ctx);
  if (profile.status === "suspended") throw new Error("Your account is suspended");
  if (profile.status === "banned") throw new Error("Your account is banned");
  if (profile.status !== "approved") {
    throw new Error("Your account is awaiting approval");
  }
  return profile;
}

export type AdminPermission =
  | "applications"
  | "users"
  | "admins"
  | "verification"
  | "reports"
  | "rules"
  | "groups"
  | "moderation"
  | "files"
  | "audit"
  | "privacy"
  | "security"
  | "settings"
  | "integrations";

export const ADMIN_PERMISSIONS: AdminPermission[] = [
  "applications",
  "users",
  "admins",
  "verification",
  "reports",
  "rules",
  "groups",
  "moderation",
  "files",
  "audit",
  "privacy",
  "security",
  "settings",
  "integrations",
];

export function isCreator(profile: Profile): boolean {
  return profile.role === "creator" && profile.status === "approved";
}

export function isAdmin(profile: Profile): boolean {
  return (
    (profile.role === "admin" || profile.role === "creator") &&
    profile.status === "approved"
  );
}

/** Creator or admin — gate for /admin routes and dashboard functions. */
export async function requireAdmin(ctx: AnyCtx): Promise<Profile> {
  const profile = await requireApproved(ctx);
  if (!isAdmin(profile)) throw new Error("Admin access required");
  return profile;
}

export async function requireCreator(ctx: AnyCtx): Promise<Profile> {
  const profile = await requireApproved(ctx);
  if (profile.role !== "creator") throw new Error("Creator access required");
  return profile;
}

/** Permission-scoped admin check. Creator always passes. */
export async function requirePermission(
  ctx: AnyCtx,
  permission: AdminPermission,
): Promise<Profile> {
  const profile = await requireAdmin(ctx);
  if (profile.role === "creator") return profile;
  const granted = (profile as Profile & { permissions?: string[] }).permissions ?? [];
  if (!granted.includes(permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
  return profile;
}

/**
 * Verification data is the most sensitive content in Blindspot. Only the
 * creator — or an admin explicitly granted access — may read it. Admins do
 * NOT get it automatically.
 */
export async function requireVerificationAccess(ctx: AnyCtx): Promise<Profile> {
  const profile = await requireAdmin(ctx);
  if (profile.role === "creator") return profile;
  if (!hasDb(ctx)) throw new Error("Verification access requires db context");
  const grant = await ctx.db
    .query("verificationAccess")
    .withIndex("adminUserId", (q) => q.eq("adminUserId", profile._id))
    .first();
  if (!grant) throw new Error("Verification access not granted");
  return profile;
}

/** Resolve a profile for a Better Auth subject (used by triggers). */
export async function getProfileByAuthSubject(
  ctx: DbCtx,
  subject: string,
): Promise<Profile | null> {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("authUserId", (q) => q.eq("authUserId", subject))
    .unique();
  return profile ?? null;
}

/** Is conversation membership required and held by this user? */
export async function assertConversationParticipant(
  ctx: DbCtx,
  conversationId: Id<"conversations">,
  userId: ProfileId,
): Promise<void> {
  const membership = await ctx.db
    .query("conversationMembers")
    .withIndex("conversationId_userId", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId),
    )
    .first();
  if (!membership || membership.state !== "active") {
    throw new Error("Not a participant of this conversation");
  }
}

export async function isBlockedBetween(
  ctx: DbCtx,
  a: ProfileId,
  b: ProfileId,
): Promise<boolean> {
  const one = await ctx.db
    .query("blocks")
    .withIndex("blockerId_blockedId", (q) => q.eq("blockerId", a).eq("blockedId", b))
    .first();
  if (one) return true;
  const two = await ctx.db
    .query("blocks")
    .withIndex("blockerId_blockedId", (q) => q.eq("blockerId", b).eq("blockedId", a))
    .first();
  return Boolean(two);
}

export async function audit(
  ctx: GenericMutationCtx<DataModel>,
  actor: Profile | null,
  action: string,
  opts?: {
    targetType?: string;
    targetId?: string;
    summary?: string;
  },
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    actorId: actor?._id,
    actorLabel: actor?.username ?? "system",
    action,
    targetType: opts?.targetType,
    targetId: opts?.targetId,
    summary: opts?.summary,
    at: Date.now(),
  });
}
