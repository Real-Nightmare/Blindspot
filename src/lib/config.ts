/**
 * Central runtime configuration.
 *
 * Convex deployment URLs are public identifiers (not secrets), so they are
 * hardcoded here as the production default. Environment variables are only
 * honored in dev builds — Freebuff's hosting build inlines env values in an
 * obfuscated `{v:"v2",c,k}` form that nothing in the app can decode (this
 * caused a blank production page), so production ignores them entirely.
 */

const CLOUD_CONVEX_URL = "https://tough-donkey-514.convex.cloud";
const CLOUD_CONVEX_SITE_URL = "https://tough-donkey-514.convex.site";

function isPlainHttpUrl(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("http");
}

const devConvexUrl = import.meta.env.VITE_CONVEX_URL;
const devSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL;

/** Convex backend (queries/mutations/actions + websocket). */
export const CONVEX_URL: string =
  import.meta.env.DEV && isPlainHttpUrl(devConvexUrl)
    ? devConvexUrl
    : CLOUD_CONVEX_URL;

/** Convex HTTP actions (Better Auth endpoints live here). */
export const CONVEX_SITE_URL: string =
  import.meta.env.DEV && isPlainHttpUrl(devSiteUrl)
    ? devSiteUrl
    : CLOUD_CONVEX_SITE_URL;
