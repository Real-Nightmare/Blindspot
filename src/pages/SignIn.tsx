import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery as useConvexQuery } from "convex/react";
import { Authenticated } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { Logo } from "@/components/Logo";
import { Button, Card, ErrorNote, Input, Label } from "@/components/ui";
import { authReturnPath } from "@/App";

export function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigate once the Convex session is live (server-confirmed). The profile
  // query only resolves when the client is authenticated, so this is a
  // reliable "you are signed in" signal without polling.
  const profile = useConvexQuery(api.provision.myProfile, {});
  useEffect(() => {
    if (profile !== undefined && profile !== null && !busy) {
      navigate(authReturnPath(), { replace: true });
    }
  }, [profile, busy, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: authError } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError(authError.message ?? "Could not sign in. Check your email and password.");
      setBusy(false);
      return;
    }
    // Wait briefly for the Convex token/profile to resolve, then navigate.
    // Fallback navigation keeps the button responsive even if the profile
    // query is slow.
    await new Promise((r) => setTimeout(r, 600));
    if (!busy) navigate(authReturnPath(), { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="p-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center px-5 pb-24">
        <Card className="w-full max-w-sm p-8">
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            <Logo size={44} className="text-foreground" />
            <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to enter Blindspot.</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <ErrorNote message={error} />
            <Button type="submit" className="w-full" loading={busy} variant="accent">
              Sign in
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link to="/join" className="font-medium text-accent hover:underline">
              Request access
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
