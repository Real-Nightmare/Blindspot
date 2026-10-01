import { authClient } from "./auth-client";

/**
 * Per-tab session scoping.
 *
 * Desired behavior:
 * - Refreshing, navigating, or switching away from the tab keeps everything
 *   (no reset — sessionStorage survives all of these).
 * - CLOSING the tab ends the session: sessionStorage dies with the tab, so on
 *   the next visit we detect a "fresh visit" and proactively sign out
 *   server-side, clearing the long-lived HttpOnly auth cookie. The visitor
 *   must sign in again.
 *
 * The flag lives in sessionStorage and is NEVER removed by page events:
 * `pagehide`/`unload` also fire on plain refreshes, and clearing the flag
 * there would sign people out on every F5 (a bug we explicitly avoid).
 */

const TAB_FLAG = "bs-tab-active";

/** True on the first page load of a brand-new tab (or if storage is blocked). */
export function isFreshVisit(): boolean {
  try {
    return sessionStorage.getItem(TAB_FLAG) !== "1";
  } catch {
    return true;
  }
}

/**
 * Run once at startup, before the first meaningful render:
 * - fresh visit (new tab)  → clear any stale server session, mark tab active
 * - same tab (reload/nav)  → keep everything as-is
 */
export async function initTabSession(): Promise<void> {
  const fresh = isFreshVisit();
  // Mark immediately — the sign-out below is async and must not race with
  // quick reloads deciding "freshness".
  try {
    sessionStorage.setItem(TAB_FLAG, "1");
  } catch {
    // storage unavailable; nothing else to do
  }
  if (fresh) {
    try {
      // Ends the server session and expires the HttpOnly auth cookie that
      // survived the previous tab close. No-op for visitors who were
      // already signed out.
      await authClient.signOut({ fetchOptions: { throw: false } });
    } catch {
      // network hiccup — the 7-day server TTL is the backstop
    }
  }
}
