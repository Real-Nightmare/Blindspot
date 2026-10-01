/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as admin from "../admin.js";
import type * as adminInternal from "../adminInternal.js";
import type * as aibuilder from "../aibuilder.js";
import type * as auth from "../auth.js";
import type * as authz from "../authz.js";
import type * as calls from "../calls.js";
import type * as exports from "../exports.js";
import type * as files from "../files.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as index from "../index.js";
import type * as messaging from "../messaging.js";
import type * as profile from "../profile.js";
import type * as provision from "../provision.js";
import type * as rateLimit from "../rateLimit.js";
import type * as registration from "../registration.js";
import type * as reports from "../reports.js";
import type * as rules from "../rules.js";
import type * as settings from "../settings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  admin: typeof admin;
  adminInternal: typeof adminInternal;
  aibuilder: typeof aibuilder;
  auth: typeof auth;
  authz: typeof authz;
  calls: typeof calls;
  exports: typeof exports;
  files: typeof files;
  groups: typeof groups;
  http: typeof http;
  index: typeof index;
  messaging: typeof messaging;
  profile: typeof profile;
  provision: typeof provision;
  rateLimit: typeof rateLimit;
  registration: typeof registration;
  reports: typeof reports;
  rules: typeof rules;
  settings: typeof settings;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
