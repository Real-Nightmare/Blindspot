import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FileWarning, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Badge, Button, Card, EmptyState, ErrorNote, Spinner } from "@/components/ui";

export function VerificationSection() {
  const items = useQuery(api.admin.listVerification, {});
  const markReviewed = useMutation(api.admin.markVerificationReviewed);
  const deleteData = useMutation(api.admin.deleteVerificationData);
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

  return (
    <div className="p-5 sm:p-8">
      <div className="flex items-center gap-2.5">
        <Lock className="h-5 w-5 text-accent" />
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Verification</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Private interviews and material. Only you (and admins you explicitly authorize) can open this section.
          </p>
        </div>
      </div>
      <ErrorNote message={error} />
      <div className="mt-6 space-y-3">
        {items === undefined ? (
          <Spinner className="mx-auto mt-10" />
        ) : items.length === 0 ? (
          <EmptyState title="Nothing pending" hint="Request an interview from an application to start a verification thread." />
        ) : (
          items.map((v) => (
            <Card key={v._id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{v.username}</p>
                  <p className="text-xs text-muted-foreground">{v.email}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone={v.state === "submitted" ? "accent" : v.state === "reviewed" ? "success" : "warning"}>{v.state}</Badge>
                    <Badge tone="neutral">{v.kind}</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  {v.state === "submitted" && (
                    <Button size="sm" variant="secondary" loading={busy === `r-${v._id}`} onClick={() => run(`r-${v._id}`, () => markReviewed({ verificationId: v._id as never }))}>
                      <ShieldCheck className="h-4 w-4" /> Mark reviewed
                    </Button>
                  )}
                  <Button size="sm" variant="danger" loading={busy === `d-${v._id}`} onClick={() => run(`d-${v._id}`, () => deleteData({ verificationId: v._id as never }))}>
                    <Trash2 className="h-4 w-4" /> Delete permanently
                  </Button>
                </div>
              </div>
              {v.note && <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Prompt: {v.note}</p>}
              {v.answers && (
                <div className="mt-3 rounded-lg border border-border bg-background/60 p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Applicant's answers</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{v.answers}</p>
                </div>
              )}
              {v.fileIds && v.fileIds.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileWarning className="h-3.5 w-3.5" /> {v.fileName ?? "Verification material"}
                  </p>
                  <VerificationFiles ids={v.fileIds} />
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function VerificationFiles({ ids }: { ids: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <VerificationFile key={id} id={id} />
      ))}
    </div>
  );
}

function VerificationFile({ id }: { id: string }) {
  const url = useQuery(api.files.getVerificationFileUrl, { storageId: id as never });
  if (url === undefined) return <span className="text-xs text-muted-foreground">loading…</span>;
  if (!url) return <span className="text-xs text-destructive">unavailable</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="focus-ring rounded-lg border border-border px-3 py-1.5 text-xs hover:border-accent/50">
      Open attachment
    </a>
  );
}
