import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Download, FileHeart, Globe, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button, Card, ErrorNote } from "@/components/ui";
import { PageHeader } from "./AppShell";

export function PrivacyCenterPage() {
  const exportData = useAction(api.files.exportMyData);
  const deleteMyData = useMutation(api.files.deleteMyData);
  const deleteAccount = useMutation(api.profile.deleteAccount);
  const blocks = useQuery(api.reports.listBlocked, {});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const doExport = async () => {
    setBusy("export");
    setError(null);
    try {
      const data = await exportData({});
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `blindspot-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("Export downloaded.");
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Privacy Center" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-accent" />
              <h2 className="font-display text-lg font-semibold">What we collect — and don't</h2>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>✓ Your username and whatever you choose to put on your profile.</li>
              <li>✓ The content you post — visible only to its conversation.</li>
              <li>✗ No analytics, advertising IDs, device fingerprints, or tracking pixels.</li>
              <li>✗ No application-level IP logging, no precise location.</li>
              <li>
                ⚠ Like any website, our hosting infrastructure may keep short-lived technical
                logs (e.g. connection metadata) outside Blindspot's control. We don't enrich or
                store them in the application.
              </li>
            </ul>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2.5">
              <Globe className="h-5 w-5 text-accent" />
              <h2 className="font-display text-lg font-semibold">Privacy networks (Tor)</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A browser page cannot force your device's traffic through Tor — pretending
              otherwise would be dishonest. If you need network-level anonymity, run this site
              inside the <strong>Tor Browser</strong> or a system-wide Tor setup: Blindspot sets
              no cookies beyond your session and loads no third-party scripts, so it works
              anywhere an ordinary HTTPS page does. Blindspot will never proxy your traffic
              through a server we control.
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2.5">
              <FileHeart className="h-5 w-5 text-accent" />
              <h2 className="font-display text-lg font-semibold">Blocked members</h2>
            </div>
            {blocks && blocks.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-sm">
                {blocks.map((b) => (
                  <li key={b.blockedId} className="rounded-lg bg-muted px-3 py-1.5">@{b.username}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">You haven't blocked anyone.</p>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2.5">
              <Download className="h-5 w-5 text-accent" />
              <h2 className="font-display text-lg font-semibold">Your data</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Export everything associated with your account as JSON: profile, messages,
              notifications and groups. Nothing is withheld.
            </p>
            <ErrorNote message={error} />
            {notice && <p className="mt-2 text-sm text-success">{notice}</p>}
            <Button className="mt-4" variant="secondary" loading={busy === "export"} onClick={doExport}>
              <Download className="h-4 w-4" /> Export my data
            </Button>
          </Card>

          <Card className="border-destructive/30 p-6">
            <div className="flex items-center gap-2.5">
              <Trash2 className="h-5 w-5 text-destructive" />
              <h2 className="font-display text-lg font-semibold">Delete everything</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Removes your files from storage immediately and marks your account deleted.
              Type <strong>delete everything</strong> to confirm.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="delete everything"
                className="focus-ring h-10 flex-1 rounded-lg border border-input bg-card px-3 text-sm"
                aria-label="Confirmation phrase"
              />
              <Button
                variant="danger"
                disabled={confirmText.trim().toLowerCase() !== "delete everything"}
                loading={busy === "wipe"}
                onClick={async () => {
                  setBusy("wipe");
                  try {
                    await deleteMyData({});
                    await deleteAccount({});
                    window.location.href = "/";
                  } catch (e) {
                    setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Deletion failed");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete my data
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
