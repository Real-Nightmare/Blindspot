import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { MessageCircle, Search, Star, Flag } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Avatar, Button, Card, EmptyState, ErrorNote, Input } from "@/components/PageParts";
import { PageHeader } from "./AppShell";

export function PeoplePage() {
  const [search, setSearch] = useState("");
  const people = useQuery(api.profile.discoverUsers, { search: search || undefined });
  const openDm = useMutation(api.messaging.openDm);
  const addTrusted = useMutation(api.reports.addTrustedContact);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trusted, setTrusted] = useState<string[]>([]);

  const startDm = async (userId: string) => {
    setBusyId(userId);
    setError(null);
    try {
      await openDm({ otherUserId: userId as never });
      window.location.hash = "";
      // After opening, the chat list shows the conversation.
      setError(null);
      alert("Conversation opened — find it under Chats.");
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Could not open conversation");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="People" />
      <div className="border-b border-border/70 p-4">
        <div className="relative mx-auto max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Find people by username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search people"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl">
          <ErrorNote message={error} />
          {people === undefined ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Looking around…</p>
          ) : people.length === 0 ? (
            <EmptyState title="No one found" hint="Only members who opted into discovery appear here." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {people.map((p) => (
                <Card key={p._id} className="flex items-center gap-3 p-4">
                  <Avatar name={p.username} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.displayName ?? p.username}{" "}
                      {p.statusEmoji && <span aria-hidden>{p.statusEmoji}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{p.username}
                      {p.statusText ? ` · ${p.statusText}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="icon"
                      variant="secondary"
                      title="Message"
                      loading={busyId === p._id}
                      onClick={() => void startDm(p._id)}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Add to trusted contacts"
                      onClick={() => {
                        void addTrusted({ contactId: p._id as never });
                        setTrusted((t) => [...t, p._id]);
                      }}
                    >
                      <Star className={`h-4 w-4 ${trusted.includes(p._id) ? "fill-warning text-warning" : ""}`} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Last-active times are hidden by default. Members choose what to share.
          </p>
        </div>
      </div>
    </div>
  );
}
