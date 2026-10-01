import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, MessageSquareText, X } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Avatar, Badge, Button, Card, EmptyState, ErrorNote, Input, Spinner } from "@/components/ui";

export function ApplicationsSection() {
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const apps = useQuery(api.admin.listApplications, { state: filter });
  const review = useMutation(api.admin.reviewApplication);
  const requestInterview = useMutation(api.admin.requestInterview);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Full names and emails are private verification data — visible only in this console.
          </p>
        </div>
        <div className="flex gap-1.5">
          {[
            [undefined, "All"],
            ["pending", "Pending"],
            ["interview_requested", "Interview requested"],
            ["interview_submitted", "Interview submitted"],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
          ].map(([v, label]) => (
            <button
              key={label as string}
              onClick={() => setFilter(v as string | undefined)}
              className={`focus-ring rounded-full px-3 py-1 text-xs transition-colors ${
                filter === v ? "bg-accent font-medium text-accent-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>

      <ErrorNote message={error} />

      <div className="mt-6 space-y-3">
        {apps === undefined ? (
          <Spinner className="mx-auto mt-10" />
        ) : apps.length === 0 ? (
          <EmptyState title="No applications here" hint="The waiting room is empty." />
        ) : (
          apps.map((a) => (
            <Card key={a._id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={a.user.username} size="md" />
                  <div className="min-w-0">
                    <p className="font-medium">{a.user.username}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.user.fullName} · {a.user.email}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge tone={a.state === "pending" ? "accent" : a.state === "approved" ? "success" : a.state === "rejected" ? "danger" : "warning"}>
                        {a.state.replace("_", " ")}
                      </Badge>
                      code: {a.user.inviteCodeUsed ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {a.user.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy === a._id}
                        onClick={() => act(a._id, () => requestInterview({ userId: a.user._id as never, note: undefined }))}
                      >
                        <MessageSquareText className="h-4 w-4" /> Request interview
                      </Button>
                      <Button
                        size="sm"
                        variant="accent"
                        loading={busy === a._id}
                        onClick={() => act(a._id, () => review({ applicationId: a._id as never, decision: "approve" }))}
                      >
                        <Check className="h-4 w-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setRejecting(rejecting === a._id ? null : a._id)}
                      >
                        <X className="h-4 w-4" /> Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {rejecting === a._id && (
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(a._id, () => review({ applicationId: a._id as never, decision: "reject", reason }));
                    setRejecting(null);
                    setReason("");
                  }}
                >
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shared with the applicant)" required minLength={3} />
                  <Button type="submit" variant="danger" size="md">Confirm</Button>
                </form>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
