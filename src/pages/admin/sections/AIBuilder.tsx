import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Cpu, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Badge, Button, Card, EmptyState, ErrorNote, Spinner, Textarea } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

const CONTEXT_SUMMARY = `Blindspot — React 18 + Vite SPA, Convex backend (src/convex/*) with Better Auth component.
Schema tables: profiles, inviteCodes, rules, applications, verification, groups, conversations, messages,
reactions, notifications, reports, blocks, files, auditLogs, siteSettings, integrations, calls, aiBuilderRuns.
Auth: server-side roles (creator/admin/user), statuses (pending/approved/rejected/suspended/banned/deleted),
permission-scoped admins, explicit verification-access grants. Frontend: Tailwind design tokens, dark/light.
Realtime: Convex reactive queries. Storage: Convex file storage with server-side access checks.`;

export function AIBuilderSection() {
  const runs = useQuery(api.aibuilder.listRuns, {});
  const propose = useAction(api.aibuilder.propose);
  const resolve = useMutation(api.aibuilder.resolveRun);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    setLatest(null);
    try {
      const res = await propose({ prompt, contextSummary: CONTEXT_SUMMARY });
      setLatest(res.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "The builder failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 sm:p-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">AI Builder</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Describe a feature; the builder inspects the project summary and returns a change
        proposal (files, risks, destructive flags). Proposals are drafts — nothing touches
        production until you approve, and destructive changes always require explicit
        confirmation. Requires an AI provider under Integrations.
      </p>

      <Card className="mt-6 p-5">
        <div className="flex items-center gap-2.5">
          <Cpu className="h-5 w-5 text-accent" />
          <h2 className="font-display font-semibold">New proposal</h2>
        </div>
        <Textarea
          className="mt-3"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Add a weekly digest of unread mentions, configurable in Settings → Notifications."
        />
        <ErrorNote message={error} />
        <Button className="mt-3" variant="accent" loading={busy} disabled={prompt.trim().length < 10} onClick={go}>
          <Sparkles className="h-4 w-4" /> Generate proposal
        </Button>
      </Card>

      {latest && (
        <Card className="mt-4 p-5">
          <h3 className="font-display font-semibold">Latest proposal</h3>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-background/70 p-4 text-xs leading-relaxed">
            {latest}
          </pre>
        </Card>
      )}

      <h2 className="mt-8 font-display text-lg font-semibold">History</h2>
      <div className="mt-3 space-y-2">
        {runs === undefined ? (
          <Spinner className="mx-auto mt-6" />
        ) : runs.length === 0 ? (
          <EmptyState title="No builder runs yet" hint="Generate your first proposal above." />
        ) : (
          runs.map((r) => (
            <Card key={r._id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{r.prompt}</p>
                <Badge tone={r.state === "approved" ? "success" : r.state === "rejected" ? "neutral" : r.state === "failed" ? "danger" : "accent"}>
                  {r.state}
                </Badge>
                {r.state === "proposed" && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => void resolve({ runId: r._id as never, decision: "approved" })}>
                      <ThumbsUp className="h-3.5 w-3.5" /> Approve plan
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void resolve({ runId: r._id as never, decision: "rejected" })}>
                      <ThumbsDown className="h-3.5 w-3.5" /> Discard
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
              {r.error && <p className="mt-1 text-xs text-destructive">{r.error}</p>}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
