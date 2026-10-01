import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { ArrowLeft, ScrollText } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Logo } from "@/components/Logo";
import { Card, Spinner } from "@/components/ui";

/** Public rules page — reads the same published rules as the access wizard. */
export function RulesPage() {
  const gate = useQuery(api.access.gateStatus, {});

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/70">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link to="/" className="focus-ring inline-flex items-center gap-2 rounded-lg">
            <Logo className="h-7 w-7" />
            <span className="font-display text-lg font-semibold tracking-tight">Blindspot</span>
          </Link>
          <Link
            to="/join"
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Request access
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10">
        <div className="flex items-center gap-2.5">
          <ScrollText className="h-5 w-5 text-accent" />
          <h1 className="font-display text-3xl font-semibold tracking-tight">Community rules</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Every member accepts these rules at registration. They are versioned — when they
          change, the version number changes, and new members accept the current version.
        </p>

        {gate === undefined ? (
          <div className="mt-10 flex justify-center">
            <Spinner />
          </div>
        ) : gate.rules.length === 0 ? (
          <Card className="mt-8 p-6">
            <p className="text-sm text-muted-foreground">
              The rules haven't been published yet. Check back soon.
            </p>
          </Card>
        ) : (
          <ol className="mt-8 space-y-3">
            {gate.rules.map((r, i) => (
              <li key={r.order}>
                <Card className="p-5">
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-xl font-semibold text-accent">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display font-semibold">{r.title}</h2>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {r.body}
                      </p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Current rules version: {gate?.rulesVersion ?? "—"} · See also{" "}
          <Link to="/privacy" className="underline hover:text-foreground">
            the privacy policy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
