import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Ban, CircleCheck, Hourglass, Search, ShieldAlert } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Avatar, Badge, Button, Card, EmptyState, ErrorNote, Input, Spinner } from "@/components/ui";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  approved: "success",
  pending: "warning",
  suspended: "warning",
  banned: "danger",
  rejected: "neutral",
  deleted: "neutral",
};

export function UsersSection() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);
  const users = useQuery(api.admin.listUsers, { search: search || undefined, status, limit: 200 });
  const setUserStatus = useMutation(api.admin.setUserStatus);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (userId: string, s: "approved" | "suspended" | "banned") => {
    setBusy(userId);
    setError(null);
    try {
      await setUserStatus({ userId: userId as never, status: s });
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">Suspend, ban or restore accounts. Every action is audited.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="w-56 pl-8" placeholder="Search username, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select
            value={status ?? ""}
            onChange={(e) => setStatus(e.target.value || undefined)}
            className="focus-ring h-10 rounded-lg border border-input bg-card px-2 text-sm"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {["approved", "pending", "suspended", "banned", "rejected", "deleted"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <ErrorNote message={error} />

      <div className="mt-6 space-y-2">
        {users === undefined ? (
          <Spinner className="mx-auto mt-10" />
        ) : users.length === 0 ? (
          <EmptyState title="No users match" />
        ) : (
          users.map((u) => (
            <Card key={u._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={u.username} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {u.username}
                    {u.role !== "user" && <span className="ml-2 text-xs text-accent">{u.role}</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[u.status] ?? "neutral"}>{u.status}</Badge>
                {u.status !== "approved" && u.role !== "creator" && (
                  <Button size="sm" variant="secondary" loading={busy === u._id} onClick={() => act(u._id, "approved")}>
                    <CircleCheck className="h-3.5 w-3.5" /> Restore
                  </Button>
                )}
                {u.status === "approved" && u.role === "user" && (
                  <>
                    <Button size="sm" variant="ghost" loading={busy === u._id} onClick={() => act(u._id, "suspended")} title="Suspend">
                      <Hourglass className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" loading={busy === u._id} onClick={() => act(u._id, "banned")} title="Ban">
                      <Ban className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </>
                )}
                {u.role === "creator" && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ShieldAlert className="h-3.5 w-3.5" /> protected
                  </span>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
