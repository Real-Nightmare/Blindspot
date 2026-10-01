import { createAuthClient } from "better-auth/react";
import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";
import { CONVEX_SITE_URL } from "./config";

export const authClient = createAuthClient({
  baseURL: CONVEX_SITE_URL,
  plugins: [
    convexClient(),
    crossDomainClient({
      // Session cookie state is scoped to the browser tab: sessionStorage dies
      // with the tab, so closing it ends the client-side session. Combined with
      // the fresh-visit sign-out in tab-session.ts, every new visit requires
      // signing in again.
      storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
    }),
  ],
});
