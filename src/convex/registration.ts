import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { authComponent } from "./auth";

/**
 * Registration entry point.
 *
 * The client first signs the user up via Better Auth (authClient.signUp.email
 * with username + name), then calls this action with the profile fields. It
 * links the Better Auth user to a Blindspot profile, handles creator election
 * for the very first account, and enforces the invite-code gate once a
 * creator exists. Everything sensitive runs server-side.
 */
export const completeRegistration = action({
  args: {
    fullName: v.string(),
    username: v.string(),
    inviteCode: v.string(),
    acceptedRulesVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) throw new Error("Not authenticated");
    const email: string = authUser.email;

    const result = (await ctx.runMutation(internal.provision.registerProfile, {
      authUserId: authUser._id as unknown as string,
      email,
      fullName: args.fullName,
      username: args.username,
      inviteCode: args.inviteCode,
      acceptedRulesVersion: args.acceptedRulesVersion,
    })) as { profileId: string; outcome: string };
    return result;
  },
});

/**
 * Secure creator recovery: redeem one of the hashed recovery codes generated
 * by the creator. Restores full access if the creator account was locked.
 */
export const recoverCreator = action({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) throw new Error("Not authenticated");
    const result = (await ctx.runMutation(api.access.redeemRecoveryCode, {
      authUserId: authUser._id as unknown as string,
      code: args.code,
    })) as { ok: boolean };
    return result;
  },
});
