import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Badge, Button, Card, EmptyState, ErrorNote, Spinner } from "@/components/ui";

export function GroupsSection() {
  const groups = useQuery(api.groups.adminListGroups, {});
  const del = useMutation(api.groups.adminDeleteGroup);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="p-5 sm:p-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Groups</h1>
      <p className="mt-1 text-sm text-muted-foreground">All circles on the server, with moderation powers.</p>
      <ErrorNote message={error} />
      <div className="mt-6 space-y-2">
        {groups === undefined ? (
          <Spinner className="mx-auto mt-10" />
        ) : groups.length === 0 ? (
          <EmptyState title="No groups exist yet" />
        ) : (
          groups.map((g) => (
            <Card key={g._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">{g.name}</p>
                <p className="text-xs text-muted-foreground">{g.description ?? "No description"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={g.isPrivate ? "warning" : "neutral"}>{g.isPrivate ? "private" : "invite"}</Badge>
                <Badge tone="neutral">{g.memberCount} members</Badge>
                {g.disappearingSeconds && <Badge tone="accent">ephemeral</Badge>}
                <Button
                  size="sm"
                  variant="danger"
                  loading={busy === g._id}
                  onClick={async () => {
                    if (!window.confirm(`Delete “${g.name}” and all of its messages? This cannot be undone.`)) return;
                    setBusy(g._id);
                    try {
                      await del({ groupId: g._id as never });
                    } catch (e) {
                      setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Failed");
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
