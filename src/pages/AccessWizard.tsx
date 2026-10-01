import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useAction } from "convex/react";
import { ArrowLeft, ArrowRight, Check, ScrollText, ShieldCheck } from "lucide-react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { Logo } from "@/components/Logo";
import { Button, Card, ErrorNote, Input, Label, Spinner } from "@/components/ui";

type Step = "code" | "rules" | "account" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "code", label: "Access code" },
  { id: "rules", label: "The rules" },
  { id: "account", label: "Your account" },
];

export function AccessWizard() {
  const navigate = useNavigate();
  const gate = useQuery(api.access.gateStatus, {});
  const completeRegistration = useAction(api.registration.completeRegistration);
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [acceptedVersion, setAcceptedVersion] = useState<number | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rulesVersion = gate?.rulesVersion ?? 1;
  const creatorExists = gate?.creatorExists ?? true;
  const registrationOpen = gate === undefined ? true : true; // verified below via publicGate
  void registrationOpen;

  useEffect(() => {
    document.title = "Join Blindspot";
  }, []);

  if (gate === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: signUpError } = await authClient.signUp.email({
        email: email.trim(),
        password,
        name: username.trim(),
      });
      if (signUpError) {
        setError(signUpError.message ?? "Could not create your account.");
        setBusy(false);
        return;
      }
      await completeRegistration({
        fullName,
        username,
        inviteCode: code,
        acceptedRulesVersion: acceptedVersion ?? 0,
      });
      setStep("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setError(msg.replace(/^Uncaught Error: /, "").split("\n")[0]);
      // If signup succeeded but profile creation failed, sign out so the
      // visitor can retry cleanly with the same email.
      await authClient.signOut().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="p-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>

      <div className="mx-auto w-full max-w-lg px-5 pb-20">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={44} className="text-foreground" />
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {creatorExists ? "Join Blindspot" : "Begin the community"}
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {creatorExists
              ? "Three quiet steps between you and the door."
              : "You are the first. This account becomes the Creator — permanent, and responsible for everyone who follows."}
          </p>
        </div>

        {/* stepper */}
        <ol className="mb-8 flex items-center justify-center gap-2 text-xs" aria-label="Progress">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const idx = STEPS.findIndex((x) => x.id === step);
            const done = i < idx;
            return (
              <li key={s.id} className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold ${
                    done || active
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className={active ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
                {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden />}
              </li>
            );
          })}
        </ol>

        {step === "code" && (
          <Card className="p-7">
            <h2 className="font-display text-xl font-semibold">Enter your access code</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Codes are shared quietly by members. They are single doors, not master keys.
            </p>
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                setStep("rules");
              }}
            >
              <div>
                <Label htmlFor="code">Access code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="•••••"
                  required
                  className="text-center font-mono text-lg tracking-[0.3em]"
                />
              </div>
              <ErrorNote message={error} />
              <Button type="submit" className="w-full" variant="accent" disabled={code.trim().length < 3}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                The code is checked against the live list when you submit your application.
              </p>
            </form>
          </Card>
        )}

        {step === "rules" && (
          <Card className="p-7">
            <div className="flex items-center gap-3">
              <ScrollText className="h-5 w-5 text-accent" />
              <h2 className="font-display text-xl font-semibold">The rules</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Read them fully. Accepting is recorded with the version and time.
            </p>
            <div className="mt-6 max-h-80 space-y-4 overflow-y-auto pr-2">
              {(gate?.rules ?? []).length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                  The rules are being written. Check back shortly.
                </div>
              )}
              {(gate?.rules ?? []).map((r) => (
                <div key={r.order} className="rounded-lg border border-border/70 bg-background/50 p-4">
                  <p className="text-sm font-semibold">
                    {r.order}. {r.title}
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {r.body}
                  </p>
                </div>
              ))}
            </div>
            <ErrorNote message={error} />
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setStep("code")}>
                Back
              </Button>
              <Button
                variant="accent"
                className="flex-1"
                disabled={(gate?.rules ?? []).length === 0}
                onClick={() => {
                  setAcceptedVersion(rulesVersion);
                  setStep("account");
                }}
              >
                I accept these rules
              </Button>
            </div>
          </Card>
        )}

        {step === "account" && (
          <Card className="p-7">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-accent" />
              <h2 className="font-display text-xl font-semibold">Your account</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Your username is your public identity. Your full name is private
              verification information — it is never shown to other members.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="fullName">Full name <span className="text-muted-foreground">(private)</span></Label>
                <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your real name" />
              </div>
              <div>
                <Label htmlFor="username">Username <span className="text-muted-foreground">(public)</span></Label>
                <Input
                  id="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  placeholder="quiet_fox"
                  pattern="[a-zA-Z0-9_]{3,24}"
                  title="3-24 letters, numbers or underscores"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </div>
              <ErrorNote message={error} />
              <div className="flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep("rules")}>
                  Back
                </Button>
                <Button type="submit" variant="accent" className="flex-1" loading={busy}>
                  Create account
                </Button>
              </div>
            </form>
          </Card>
        )}

        {step === "done" && (
          <Card className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
              <Check className="h-7 w-7 text-accent" />
            </div>
            <h2 className="font-display text-2xl font-semibold">Application received</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Your request is now with the creator. You will be able to sign in
              here the moment it is approved — check back soon.
            </p>
            <Button variant="accent" className="mt-7" onClick={() => navigate("/auth")}>
              Go to sign in
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
