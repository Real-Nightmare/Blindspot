import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Badge, Button, Card, EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export function GlobalModSection() {
  const feed = useQuery(api.messaging.globalChatFeed, { limit: 100 });
  const remove = useMutation(api.messaging.deleteMessage);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="p-5 sm:p-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Global Chat moderation</h1>
      <p className="mt-1 text-sm text-muted-foreground">The live feed. Removing a message marks it [removed] for members.</p>
      <ErrorNote message={error} />
      <div className="mt-6 space-y-2">
        {feed === undefined ? (
          <Spinner className="mx-auto mt-10" />
        ) : !feed.conversationId ? (
          <EmptyState title="Global Chat hasn't started yet" hint="It is created the first time a member opens it." />
        ) : feed.messages.length === 0 ? (
          <EmptyState title="No messages yet" />
        ) : (
          feed.messages.map((m) => (
            <Card key={m._id} className="flex items-start justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  @{m.authorUsername} · {formatDateTime(m.createdAt)}{" "}
                  {m.deletedAt && <Badge tone="danger">removed</Badge>}
                </p>
                <p className="mt-0.5 break-words text-sm">{m.body || (m.kind === "call" ? "call event" : "[attachment]")}</p>
              </div>
              {!m.deletedAt && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === m._id}
                  onClick={async () => {
                    setBusy(m._id);
                    try {
                      await remove({ messageId: m._id as never });
                    } catch (e) {
                      setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Failed");
                    } finally {
                      setBusy(null);
                    }
                  }}
                  title="Remove message"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
