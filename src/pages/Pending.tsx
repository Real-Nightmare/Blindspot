import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { Clock, FileQuestion, LogOut, XCircle } from "lucide-react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { Logo } from "@/components/Logo";
import { Button, Card, ErrorNote, Label, Textarea, Badge } from "@/components/ui";
import { useSession } from "@/lib/session";

export function PendingPage() {
  const { profile } = useSession();
  const requests = useQuery(api.admin.myVerificationRequests, {});
  const submitInterview = useMutation(api.admin.submitInterview);
  const [answers, setAnswers] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.title = "Blindspot — pending";
  }, []);

  const openRequest = (requests ?? []).find((r) => r.state === "requested");

  if (!profile) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <Logo size={44} />
        <p className="text-sm text-muted-foreground">Loading your place in line…</p>
        <Link to="/auth">
          <Button variant="secondary" size="sm">Sign in</Button>
        </Link>
      </div>
    );
  }

  const signOut = async () => {
    await authClient.signOut();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center justify-between p-5">
        <div className="flex items-center gap-2.5">
          <Logo size={28} className="text-foreground" />
          <span className="font-display text-lg font-semibold">Blindspot</span>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 pb-20">
        {profile.status === "rejected" ? (
          <Card className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
              <XCircle className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="font-display text-2xl font-semibold">Not this time</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {profile.rejectedReason ??
                "Your application was not approved. You are welcome to apply again with a new invitation."}
            </p>
            <Button variant="secondary" className="mt-6" onClick={signOut}>
              Sign out
            </Button>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
              <Clock className="h-7 w-7 text-accent" />
            </div>
            <h1 className="font-display text-2xl font-semibold">
              {profile.status === "suspended" || profile.status === "banned"
                ? "Your access is paused"
                : "You're in the waiting room"}
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {profile.status === "suspended" || profile.status === "banned"
                ? "A moderator has paused this account. Reach out to the creator if you believe this is a mistake."
                : "A person — not an algorithm — reviews every application. This usually takes a little while."}
            </p>
            <div className="mt-4 flex justify-center">
              <Badge tone="accent">status: {profile.status}</Badge>
            </div>

            {openRequest && (
              <div className="mt-8 rounded-xl border border-accent/30 bg-accent/5 p-5 text-left">
                <div className="flex items-center gap-2">
                  <FileQuestion className="h-5 w-5 text-accent" />
                  <p className="font-display font-semibold">Interview requested</p>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {openRequest.note || "Tell us a bit about yourself so we can say hello with context."}
                </p>
                {submitted || openRequest.state !== "requested" ? (
                  <p className="mt-3 text-sm text-success">Thank you — your answers are with the team.</p>
                ) : (
                  <form
                    className="mt-4 space-y-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      setError(null);
                      try {
                        await submitInterview({
                          verificationId: openRequest._id,
                          answers,
                          fileIds: undefined,
                          fileName: undefined,
                        });
                        setSubmitted(true);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Could not submit");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <div>
                      <Label htmlFor="answers">Your answers</Label>
                      <Textarea
                        id="answers"
                        rows={5}
                        required
                        value={answers}
                        onChange={(e) => setAnswers(e.target.value)}
                        placeholder="Who are you, and what are you looking for here?"
                      />
                    </div>
                    <ErrorNote message={error} />
                    <Button type="submit" variant="accent" loading={busy} className="w-full">
                      Send answers
                    </Button>
                  </form>
                )}
              </div>
            )}

            <Button variant="ghost" size="sm" className="mt-8" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
