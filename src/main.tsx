import { ConvexReactClient } from "convex/react";
import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import App from "./App";
import "./index.css";
import { authClient } from "./lib/auth-client";
import { CONVEX_URL } from "./lib/config";
import { initTabSession } from "./lib/tab-session";

// NOTE: no `expectAuth` — that option starts the client paused waiting for an
// auth token, and signed-out visitors never get one, so public queries
// (gateStatus on /join and /rules) would spin forever. The provider below
// calls setAuth() itself once a session exists.
const convex = new ConvexReactClient(CONVEX_URL);

// Per-tab sessions: closing the tab ends the session (fresh visits sign out
// and clear the server cookie); refreshing or navigating within the tab
// keeps everything exactly as it was.
void initTabSession();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexBetterAuthProvider client={convex} authClient={authClient as never}>
      <App />
    </ConvexBetterAuthProvider>
  </React.StrictMode>,
);
