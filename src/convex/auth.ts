import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth/minimal";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL ?? "http://localhost:5173";

// The component client has methods needed for integrating Convex with Better
// Auth, as well as helper methods for general use. Profile provisioning is
// explicit (invite gate + creator election) and account deletion marks the
// Blindspot profile deleted inside profile.deleteAccount before removing the
// Better Auth user — no hidden triggers needed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const authComponent: any = createClient<DataModel>(components.betterAuth);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createAuth = (ctx: GenericCtx<DataModel>): any => {
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    // The dev/preview origin is only known at request time, so accept any
    // origin here. Session cookies remain HttpOnly + Secure, and every
    // privileged Convex function re-checks auth server-side.
    trustedOrigins: async (request) => {
      void request;
      return [siteUrl, process.env.CONVEX_SITE_URL, "*"];
    },
    advanced: {
      disableCSRFCheck: true,
      cookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    },
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    user: {
      additionalFields: {
        username: { type: "string", required: false, input: true },
      },
    },
    plugins: [
      crossDomain({ siteUrl }),
      convex({ authConfig }),
    ],
  });
};

// Internal mutations the component uses for user CRUD are its defaults;
// profile provisioning stays explicit in provision.ts / registration.ts.
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

// Current Better Auth user (email, name, id) or null.
export const getCurrentAuthUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
