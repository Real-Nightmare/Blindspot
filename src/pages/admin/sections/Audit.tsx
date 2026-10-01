import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card, EmptyState, Spinner } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export function AuditSection() {
  // Reuse the admin guard: audit requires the audit permission via stats gate;
  // the dedicated query below is the invite + admin audit feed.
  const logs = useQuery(api.admin.listAuditLogs, {});
  return (
    <div className="p-5 sm:p-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every administrative action, in order. Entries cannot be edited or deleted from the app.
      </p>
      <div className="mt-6 space-y-1.5">
        {logs === undefined ? (
          <Spinner className="mx-auto mt-10" />
        ) : logs.length === 0 ? (
          <EmptyState title="Nothing recorded yet" />
        ) : (
          logs.map((l) => (
            <Card key={l._id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm">
              <span>
                <span className="font-medium">{l.action}</span>
                {l.summary ? <span className="text-muted-foreground"> — {l.summary}</span> : null}
              </span>
              <span className="text-xs text-muted-foreground">
                @{l.actorLabel} · {formatDateTime(l.at)}
              </span>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
