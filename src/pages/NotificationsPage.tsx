import { useMutation, useQuery } from "convex/react";
import { BellRing, CheckCheck } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button, EmptyState } from "@/components/ui";
import { PageHeader } from "./AppShell";
import { cn, relativeTime } from "@/lib/utils";

export function NotificationsPage() {
  const notifications = useQuery(api.reports.listNotifications, { limit: 50 });
  const markOne = useMutation(api.reports.markNotificationRead);
  const markAll = useMutation(api.reports.markAllNotificationsRead);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Notifications">
        <Button size="sm" variant="ghost" onClick={() => void markAll({})}>
          <CheckCheck className="h-4 w-4" /> Mark all read
        </Button>
      </PageHeader>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-xl space-y-2">
          {notifications === undefined ? (
            <p className="py-10 text-center text-sm text-muted-foreground">…</p>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={<BellRing className="h-8 w-8" />}
              title="All quiet"
              hint="Mentions, approvals and group invitations will land here."
            />
          ) : (
            notifications.map((n) => (
              <button
                key={n._id}
                onClick={() => void markOne({ notificationId: n._id as never })}
                className={cn(
                  "focus-ring block w-full rounded-xl border px-4 py-3 text-left transition-colors",
                  n.read ? "border-border/60 bg-card/50" : "border-accent/40 bg-accent/5",
                )}
              >
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{relativeTime(n.createdAt)}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
