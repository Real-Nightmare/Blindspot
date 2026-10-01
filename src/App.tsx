import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthLoading, Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ThemeProvider } from "./lib/theme";
import { SessionProvider, useSession } from "./lib/session";
import { Splash } from "./components/Splash";
import { Landing } from "./pages/Landing";
import { AccessWizard } from "./pages/AccessWizard";
import { SignInPage } from "./pages/SignIn";
import { PendingPage } from "./pages/Pending";
import { RulesPage } from "./pages/RulesPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { AppShell } from "./pages/AppShell";
import { AdminShell } from "./pages/admin/AdminShell";
import { Spinner } from "./components/ui";

function authReturnPath(): string {
  return sessionStorage.getItem("bs-returnTo") ?? "/app";
}

function RouteKeeper() {
  const location = useLocation();
  useEffect(() => {
    if (!location.pathname.startsWith("/auth")) {
      sessionStorage.setItem("bs-returnTo", location.pathname + location.search);
    }
  }, [location]);
  return null;
}

/** Approved members (and admins) reach the community; everyone else is routed. */
function CommunityGate({ children }: { children: React.ReactNode }) {
  const { profile, isApproved } = useSession();
  if (!profile) return <Navigate to="/auth" replace />;
  if (!isApproved) return <Navigate to="/pending" replace />;
  void children;
  return <AppShell />;
}

function AdminGate({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useSession();
  if (!isAdmin) return <Navigate to="/app" replace />;
  void children;
  return <>{children}</>;
}

function AuthedRoutes() {
  const profile = useQuery(api.provision.myProfile, {});
  const location = useLocation();

  if (profile === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <SessionProvider profile={profile ?? null}>
      <RouteKeeper />
      <Routes>
        <Route path="/auth" element={<Navigate to="/app" replace />} />
        <Route path="/pending" element={<PendingPage />} />
        <Route
          path="/app/*"
          element={
            <CommunityGate>
              <AppShell />
            </CommunityGate>
          }
        />
        <Route
          path="/admin/*"
          element={
            <CommunityGate>
              <AdminGate>
                <AdminShell />
              </AdminGate>
            </CommunityGate>
          }
        />
        <Route
          path="*"
          element={<Navigate to={location.pathname.startsWith("/admin") ? "/admin" : "/app"} replace />}
        />
      </Routes>
    </SessionProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthLoading>
          <Splash hidden={false} />
        </AuthLoading>
        <Unauthenticated>
          <SplashGate>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/join" element={<AccessWizard />} />
              <Route path="/auth" element={<SignInPage />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/pending" element={<Navigate to="/auth" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SplashGate>
        </Unauthenticated>
        <Authenticated>
          <SplashGate>
            <AuthedRoutes />
          </SplashGate>
        </Authenticated>
      </BrowserRouter>
    </ThemeProvider>
  );
}

/** Keep the splash up until React Router has mounted its first route. */
function SplashGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useReadyAfterPaint();
  return (
    <>
      <Splash hidden={ready} />
      <div className={ready ? "" : "h-dvh overflow-hidden"}>
        {children}
      </div>
    </>
  );
}

import { useState } from "react";
function useReadyAfterPaint(): [boolean, (v: boolean) => void] {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, []);
  return [ready, setReady];
}

export { authReturnPath };
