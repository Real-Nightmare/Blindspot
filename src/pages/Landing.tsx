import { Link } from "react-router-dom";
import { ArrowRight, EyeOff, Lock, MessageSquareHeart, ShieldCheck, Users } from "lucide-react";
import { Logo, Wordmark } from "@/components/Logo";
import { Button, Card } from "@/components/ui";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export function Landing() {
  const gate = useQuery(api.access.gateStatus, {});
  const creatorExists = gate?.creatorExists ?? false;

  return (
    <div className="min-h-dvh">
      {/* ---------------------------------------------------------- nav --- */}
      <header className="glass sticky top-0 z-40 border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5 focus-ring rounded-lg">
            <Logo size={30} className="text-foreground" />
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/join">
              <Button size="sm" variant="accent">
                Request access
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* --------------------------------------------------------- hero --- */}
      <section className="grain relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-220px] h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-20 text-center sm:pt-28">
          <p className="animate-fade-up mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-xs text-muted-foreground">
            <EyeOff className="h-3.5 w-3.5" />
            Invitation-only · No trackers · No feeds
          </p>
          <h1 className="animate-fade-up font-display text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            Somewhere between
            <br />
            <span className="italic text-accent">privacy</span> and presence.
          </h1>
          <p className="animate-fade-up mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
            Blindspot is a small, quiet community behind a door that only opens
            for people someone lets in. Conversations stay between the people
            in them. Nothing to perform for.
          </p>
          <div className="animate-fade-up mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to={creatorExists ? "/join" : "/join"} className="w-full sm:w-auto">
              <Button size="lg" variant="accent" className="w-full sm:w-auto">
                {creatorExists ? "I have an access code" : "Create the first account"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Sign in
              </Button>
            </Link>
          </div>
          <p className="mt-5 text-xs text-muted-foreground/70">
            {creatorExists
              ? "New members join with an access code and are reviewed before entering."
              : "No community exists yet — the first account becomes its creator."}
          </p>
        </div>
      </section>

      {/* --------------------------------------------------- principles --- */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="font-display text-center text-3xl font-semibold tracking-tight">
            Built to be forgotten by the internet
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
            Four commitments that shape every part of Blindspot.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Lock className="h-5 w-5" />,
                title: "Private by default",
                body: "Messages, files and groups are visible only to the people in them. Full names stay out of public view.",
              },
              {
                icon: <EyeOff className="h-5 w-5" />,
                title: "No surveillance",
                body: "No analytics, ads, fingerprints or IP logging. We collect what the community needs to run — little else.",
              },
              {
                icon: <ShieldCheck className="h-5 w-5" />,
                title: "Humans at the door",
                body: "Everyone is reviewed by a person, accepts the rules, and can be reached by the creator if anything feels wrong.",
              },
              {
                icon: <MessageSquareHeart className="h-5 w-5" />,
                title: "Presence over performance",
                body: "Chronological, calm, no like counts. Disappearing messages when you want them — never forced.",
              },
            ].map((f) => (
              <Card key={f.title} className="animate-fade-up p-6 transition-transform duration-200 hover:-translate-y-0.5">
                <div className="mb-4 inline-flex rounded-lg bg-accent/10 p-2.5 text-accent">
                  {f.icon}
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- how it works --- */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight">
                A door, not a megaphone
              </h2>
              <ol className="mt-8 space-y-6">
                {[
                  ["An access code", creatorExists ? "Someone who is already inside shares a code with you." : "The first account is free — it becomes the creator's."],
                  ["The rules", "Read and accept how we treat each other. Consent, privacy, no leaks."],
                  ["A short application", "Your username is public; your full name is private verification info."],
                  ["A human decision", "The creator (or a trusted admin) approves, chats with you first, or declines."],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/40 font-display text-sm font-semibold text-accent">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium">{t}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link to="/join" className="mt-9 inline-block">
                <Button variant="accent" size="lg">
                  Begin
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <Card className="grain relative overflow-hidden p-8">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-accent" />
                <p className="font-display text-lg font-semibold">Inside Blindspot</p>
              </div>
              <div className="mt-7 space-y-5">
                {[
                  ["Global Chat", "One quiet room for everyone — moderated, slow by design."],
                  ["Direct messages", "One-to-one, with disappearing timers and blocking that works."],
                  ["Groups", "Small circles with their own rules, files and privacy settings."],
                  ["Voice notes", "Record a thought when typing is too much. Your voice, never stored forever."],
                ].map(([t, d]) => (
                  <div key={t} className="rounded-lg border border-border/70 bg-background/60 p-4">
                    <p className="text-sm font-medium">{t}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- footer --- */}
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo size={22} className="text-muted-foreground" />
            <span>Blindspot — a private community</span>
          </div>
          <div className="flex gap-5">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/rules" className="hover:text-foreground">Rules</Link>
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
