import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card, Spinner, Badge } from "@/components/ui";

export function OverviewSection() {
  const stats = useQuery(api.admin.overviewStats, {});
  if (stats === undefined) {
    return <div className="flex h-40 items-center justify-center"><Spinner /></div>;
  }
  const cards: { label: string; value: number | string; tone?: "accent" | "warning" | "danger" }[] = [
    { label: "Members", value: stats.members },
    { label: "Pending applications", value: stats.pending, tone: "accent" },
    { label: "Staff", value: stats.staff },
    { label: "Suspended / banned", value: stats.suspended, tone: "warning" },
    { label: "Open reports", value: stats.openReports, tone: stats.openReports > 0 ? "danger" : undefined },
    { label: "Groups", value: stats.groups },
    { label: "Messages (24h)", value: stats.messages24h },
    { label: "New signups (24h)", value: stats.signups24h },
  ];
  return (
    <div className="p-5 sm:p-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Community health at a glance. Counts only — no sensitive content is shown here.
      </p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className={`mt-2 font-display text-3xl font-semibold ${c.tone === "danger" ? "text-destructive" : c.tone === "warning" ? "text-warning" : c.tone === "accent" ? "text-accent" : ""}`}>
              {c.value}
            </p>
          </Card>
        ))}
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display font-semibold">Privacy posture</h2>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p><Badge tone="success">on</Badge> Server-side authorization on every function</p>
            <p><Badge tone="success">on</Badge> No application-level IP logging</p>
            <p><Badge tone="success">on</Badge> Verification data restricted to authorized staff</p>
            <p><Badge tone="success">on</Badge> Audit log for administrative actions</p>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-display font-semibold">Quick actions</h2>
          <div className="mt-3 space-y-1.5 text-sm">
            <a href="/admin/applications" className="block rounded-lg px-3 py-2 hover:bg-muted">Review pending applications →</a>
            <a href="/admin/reports" className="block rounded-lg px-3 py-2 hover:bg-muted">Triage open reports →</a>
            <a href="/admin/integrations" className="block rounded-lg px-3 py-2 hover:bg-muted">Configure integrations →</a>
          </div>
        </Card>
      </div>
    </div>
  );
}
