import { useEffect, useState } from "react";
import { NavLink, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { MessageCircle, Globe2, Users, Settings2, ShieldHalf, LogOut, DoorOpen } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { Avatar, Badge, Button, Spinner } from "@/components/ui";
import { ChatPage } from "./ChatPage";
import { PeoplePage } from "./PeoplePage";
import { GroupsPage } from "./GroupsPage";
import { SettingsPage } from "./SettingsPage";
import { PrivacyCenterPage } from "./PrivacyCenterPage";
import { NotificationsPage } from "./NotificationsPage";

function NavItem({
  to,
  icon,
  label,
  badge,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `focus-ring group relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
          isActive ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`
      }
      aria-label={label}
      title={label}
    >
      {icon}
      {badge ? (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </NavLink>
  );
}

export function AppShell() {
  const { profile, isAdmin, isCreator } = useSession();
  const navigate = useNavigate();
  const unread = useQuery(api.reports.unreadCount, {}) ?? 0;
  const touch = useMutation(api.provision.touchLastActive);
  const [online, setOnline] = useState(navigator.onLine);

  // Presence heartbeat, every 4 minutes.
  useEffect(() => {
    void touch();
    const t = setInterval(() => void touch(), 240_000);
    return () => clearInterval(t);
  }, [touch]);

  // Offline banner state
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const signOut = async () => {
    await authClient.signOut();
    navigate("/", { replace: true });
  };

  // Panic exit: immediately wipe the token client-side and land on a neutral page.
  const panicExit = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("__convexAuth") || k.includes("better-auth"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* noop */
    }
    window.location.href = "https://www.wikipedia.org/wiki/Special:Random";
  };

  if (!profile) return <Spinner />;

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* rail */}
      <nav className="flex w-16 shrink-0 flex-col items-center border-r border-border/70 bg-card/40 py-4 sm:w-20">
        <NavLink to="/app" className="focus-ring mb-6 rounded-lg" aria-label="Blindspot home">
          <Logo size={32} className="text-foreground" />
        </NavLink>
        <div className="flex flex-1 flex-col items-center gap-2">
          <NavItem to="/app" icon={<MessageCircle className="h-5 w-5" />} label="Chats" badge={unread} />
          <NavItem to="/app/global" icon={<Globe2 className="h-5 w-5" />} label="Global Chat" />
          <NavItem to="/app/groups" icon={<Users className="h-5 w-5" />} label="Groups" />
          <NavItem to="/app/people" icon={<Users className="h-5 w-5" />} label="People" />
          <NavItem to="/app/notifications" icon={<MessageCircle className="h-5 w-5" />} label="Notifications" badge={unread} />
        </div>
        <div className="flex flex-col items-center gap-2">
          {isAdmin && (
            <NavItem
              to="/admin"
              icon={<ShieldHalf className="h-5 w-5" />}
              label={isCreator ? "Creator console" : "Admin console"}
            />
          )}
          <NavItem to="/app/privacy" icon={<DoorOpen className="h-5 w-5" />} label="Privacy center" />
          <NavItem to="/app/settings" icon={<Settings2 className="h-5 w-5" />} label="Settings" />
          <button
            onClick={panicExit}
            className="focus-ring mt-2 flex h-11 w-11 items-center justify-center rounded-xl text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Quick exit"
            title="Quick exit (clears session)"
          >
            <LogOut className="h-5 w-5" />
          </button>
          <button
            onClick={signOut}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Sign out"
            title="Sign out"
          >
            <Avatar name={profile.username} src={null} size="sm" />
          </button>
        </div>
      </nav>

      {/* content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!online && (
          <div className="bg-warning/15 px-4 py-1.5 text-center text-xs text-warning">
            You are offline — messages will sync when the connection returns.
          </div>
        )}
        <Routes>
          <Route index element={<ChatPage />} />
          <Route path="global" element={<ChatPage global />} />
          <Route path="chat/:conversationId" element={<ChatPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="people" element={<PeoplePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="privacy" element={<PrivacyCenterPage />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/70 px-5">
      <h1 className="font-display text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export { Badge };
