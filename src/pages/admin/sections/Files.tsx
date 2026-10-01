import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { Sparkles } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button, Card, ErrorNote, Spinner } from "@/components/ui";

export function FilesSection() {
  const stats = useQuery(api.admin.overviewStats, {});
  const runSweep = useAction(api.files.runSweep);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="p-5 sm:p-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Files</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Files are private to their conversation and never publicly listed. Access is checked on every request.
      </p>
      <ErrorNote message={error} />
      {notice && <p className="mt-3 text-sm text-success">{notice}</p>}
      <Card className="mt-6 p-5">
        <h2 className="font-display font-semibold">Retention</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The retention sweep deletes expired disappearing-messages and any files older than
          the configured retention policy (Site Settings → retentionDays).
        </p>
        <Button
          className="mt-4"
          variant="secondary"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const removed = await runSweep({});
              setNotice(`Sweep complete — ${removed} item(s) removed.`);
            } catch (e) {
              setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Sweep failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Sparkles className="h-4 w-4" /> Run retention sweep now
        </Button>
      </Card>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Uploads (24h approx.)</p>
          <p className="mt-2 font-display text-2xl font-semibold">{stats === undefined ? <Spinner className="h-4 w-4" /> : stats.messages24h}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Max upload size</p>
          <p className="mt-2 font-display text-2xl font-semibold">25 MB</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Access model</p>
          <p className="mt-2 text-sm">owner + conversation members only</p>
        </Card>
      </div>
    </div>
  );
}
