import { Link } from "react-router-dom";
import { ArrowLeft, Eye, FileHeart, Globe, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui";

/**
 * Public privacy policy — deliberately honest about what Blindspot can and
 * cannot promise (mirrors the in-app Privacy Center).
 */
export function PrivacyPage() {
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

      <main className="mx-auto max-w-2xl space-y-4 px-5 py-10">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <h1 className="font-display text-3xl font-semibold tracking-tight">Privacy policy</h1>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Blindspot is a small, private community. This page describes exactly what the
          application collects, what it deliberately does not, and where the honest limits are.
        </p>

        <Card className="p-6">
          <div className="flex items-center gap-2.5">
            <Eye className="h-5 w-5 text-accent" />
            <h2 className="font-display text-lg font-semibold">What we collect — and don't</h2>
          </div>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>✓ Your username and whatever you choose to put on your profile.</li>
            <li>✓ The content you post — visible only to its conversation.</li>
            <li>✗ No analytics, advertising IDs, device fingerprints, or tracking pixels.</li>
            <li>✗ No application-level IP logging, no precise location.</li>
            <li>
              ⚠ Like any website, our hosting infrastructure may keep short-lived technical
              logs (e.g. connection metadata) outside Blindspot's control. The application
              does not enrich or store them.
            </li>
          </ul>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2.5">
            <Globe className="h-5 w-5 text-accent" />
            <h2 className="font-display text-lg font-semibold">Privacy networks (Tor)</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            A web page cannot force your device's traffic through Tor — claiming otherwise
            would be dishonest. If you need network-level anonymity, run this site inside the{" "}
            <strong>Tor Browser</strong> or a system-wide Tor setup. Blindspot sets no cookies
            beyond your session and loads no third-party scripts, so it works anywhere an
            ordinary HTTPS page does. We will never proxy your traffic through a server we
            control.
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2.5">
            <FileHeart className="h-5 w-5 text-accent" />
            <h2 className="font-display text-lg font-semibold">Your data, your call</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Inside the app, the Privacy Center lets you export everything associated with your
            account as JSON — profile, messages, notifications, groups, nothing withheld — and
            delete your files and account at any time. Verification material is stored
            encrypted-at-rest by the platform and readable only by the creator or staff they
            explicitly authorize.
          </p>
        </Card>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          See also{" "}
          <Link to="/rules" className="underline hover:text-foreground">
            the community rules
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
