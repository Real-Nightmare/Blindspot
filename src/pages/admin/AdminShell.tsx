import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import {
  BarChart3, ClipboardCheck, FileBox, Gavel, KeyRound, LayoutDashboard,
  Megaphone, ScrollText, ShieldHalf, UserCog, Users, Settings2, Cpu, History, Lock,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { OverviewSection } from "./sections/Overview";
import { ApplicationsSection } from "./sections/Applications";
import { UsersSection } from "./sections/Users";
import { AdminsSection } from "./sections/Admins";
import { VerificationSection } from "./sections/Verification";
import { ReportsSection } from "./sections/Reports";
import { RulesSection } from "./sections/Rules";
import { GroupsSection } from "./sections/Groups";
import { GlobalModSection } from "./sections/GlobalMod";
import { FilesSection } from "./sections/Files";
import { AuditSection } from "./sections/Audit";
import { SettingsSection } from "./sections/SettingsSection";
import { IntegrationsSection } from "./sections/Integrations";
import { AIBuilderSection } from "./sections/AIBuilder";

const NAV: { to: string; label: string; icon: React.ReactNode; perm: string }[] = [
  { to: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" />, perm: "*" },
  { to: "applications", label: "Applications", icon: <ClipboardCheck className="h-4 w-4" />, perm: "applications" },
  { to: "users", label: "Users", icon: <Users className="h-4 w-4" />, perm: "users" },
  { to: "admins", label: "Admins", icon: <UserCog className="h-4 w-4" />, perm: "admins" },
  { to: "verification", label: "Verification", icon: <Lock className="h-4 w-4" />, perm: "verification" },
  { to: "reports", label: "Reports", icon: <Gavel className="h-4 w-4" />, perm: "reports" },
  { to: "rules", label: "Rules", icon: <ScrollText className="h-4 w-4" />, perm: "rules" },
  { to: "groups", label: "Groups", icon: <Megaphone className="h-4 w-4" />, perm: "groups" },
  { to: "global", label: "Global Chat", icon: <BarChart3 className="h-4 w-4" />, perm: "moderation" },
  { to: "files", label: "Files", icon: <FileBox className="h-4 w-4" />, perm: "files" },
  { to: "audit", label: "Audit Log", icon: <History className="h-4 w-4" />, perm: "audit" },
  { to: "site", label: "Site Settings", icon: <Settings2 className="h-4 w-4" />, perm: "settings" },
  { to: "integrations", label: "Integrations", icon: <KeyRound className="h-4 w-4" />, perm: "integrations" },
  { to: "ai", label: "AI Builder", icon: <Cpu className="h-4 w-4" />, perm: "*" },
];

export function AdminShell() {
  const { isCreator, permissions } = useSession();
  const can = (perm: string) =>
    isCreator || permissions.includes("*") || permissions.includes(perm);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="flex w-14 flex-col items-center border-r border-border/70 bg-card/40 py-4 sm:w-56 sm:items-stretch sm:px-3">
        <NavLink to="/app" className="focus-ring mb-6 flex items-center justify-center gap-2 sm:justify-start sm:px-2">
          <Logo size={28} className="text-foreground" />
          <span className="hidden font-display text-lg font-semibold sm:block">Console</span>
        </NavLink>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Admin sections">
          {NAV.filter((n) => can(n.perm)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "focus-ring flex h-9 items-center justify-center gap-2.5 rounded-lg px-2 text-sm transition-colors sm:justify-start",
                  isActive ? "bg-accent/15 font-medium text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
              title={n.label}
            >
              {n.icon}
              <span className="hidden sm:block">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-2 pt-3 text-[10px] leading-relaxed text-muted-foreground sm:block">
          {isCreator ? "Creator — full control" : "Admin — limited permissions"}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewSection />} />
          <Route path="applications" element={<ApplicationsSection />} />
          <Route path="users" element={<UsersSection />} />
          <Route path="admins" element={<AdminsSection />} />
          <Route path="verification" element={<VerificationSection />} />
          <Route path="reports" element={<ReportsSection />} />
          <Route path="rules" element={<RulesSection />} />
          <Route path="groups" element={<GroupsSection />} />
          <Route path="global" element={<GlobalModSection />} />
          <Route path="files" element={<FilesSection />} />
          <Route path="audit" element={<AuditSection />} />
          <Route path="site" element={<SettingsSection />} />
          <Route path="integrations" element={<IntegrationsSection />} />
          <Route path="ai" element={<AIBuilderSection />} />
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export { ShieldHalf };
