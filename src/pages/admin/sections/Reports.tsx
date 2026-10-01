import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Badge, Button, Card, EmptyState, ErrorNote, Spinner } from "@/components/ui";

export function ReportsSection() {
  const [state, setState] = useState<string | undefined>(undefined);
  const reports = useQuery(api.reports.adminListReports, { state });
  const update = useMutation(api.reports.updateReportState);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const TONE: Record<string, "accent" | "warning" | "success" | "neutral"> = {
    open: "accent",
    reviewing: "warning",
    resolved: "success",
    dismissed: "neutral",
  };

  return (
    <div className="p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">open → reviewing → resolved / dismissed</p>
        </div>
        <div className="flex gap-1.5">
          {[
            [undefined, "All"],
            ["open", "Open"],
            ["reviewing", "Reviewing"],
            ["resolved", "Resolved"],
            ["dismissed", "Dismissed"],
          ].map(([v, label]) => (
            <button
              key={label as string}
              onClick={() => setState(v as string | undefined)}
              className={`focus-ring rounded-full px-3 py-1 text-xs ${state === v ? "bg-accent font-medium text-accent-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>
      <ErrorNote message={error} />
      <div className="mt-6 space-y-3">
        {reports === undefined ? (
          <Spinner className="mx-auto mt-10" />
        ) : reports.length === 0 ? (
          <EmptyState title="No reports" hint="A quiet community is a healthy community." />
        ) : (
          reports.map((r) => (
            <Card key={r._id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {r.targetType} reported by @{r.reporterUsername}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.reason}</p>
                  {r.details && <p className="mt-1 text-xs text-muted-foreground">{r.details}</p>}
                  <Badge tone={TONE[r.state] ?? "neutral"}>{r.state}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.state === "open" && (
                    <Button size="sm" variant="secondary" loading={busy === r._id} onClick={() => run(r._id, () => update({ reportId: r._id as never, state: "reviewing" }))}>
                      Start reviewing
                    </Button>
                  )}
                  {r.state !== "resolved" && (
                    <Button size="sm" variant="accent" loading={busy === r._id} onClick={() => run(r._id, () => update({ reportId: r._id as never, state: "resolved", resolution: "Handled" }))}>
                      Resolve
                    </Button>
                  )}
                  {r.state !== "dismissed" && (
                    <Button size="sm" variant="ghost" loading={busy === r._id} onClick={() => run(r._id, () => update({ reportId: r._id as never, state: "dismissed", resolution: "No action" }))}>
                      Dismiss
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
