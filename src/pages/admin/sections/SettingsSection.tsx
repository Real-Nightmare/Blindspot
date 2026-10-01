import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { KeyRound, LifeBuoy, ShieldAlert } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Badge, Button, Card, ErrorNote, Input, Label, Select, Switch } from "@/components/ui";

export function SettingsSection() {
  const flags = useQuery(api.settings.getSiteFlags, {});
  const setFlag = useMutation(api.settings.setSiteFlag);
  const codes = useQuery(api.access.listInviteCodes, {});
  const upsertCode = useMutation(api.access.upsertInviteCode);
  const audit = useQuery(api.access.inviteAuditTrail, {});
  const genRecovery = useMutation(api.access.generateRecoveryCodes);
  const [newCode, setNewCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [retention, setRetention] = useState("0");

  const switches: { key: "registrationOpen" | "uploadsEnabled" | "callsEnabled" | "globalChatEnabled"; label: string; hint: string }[] = [
    { key: "registrationOpen", label: "Registration open", hint: "New applications can be submitted" },
    { key: "uploadsEnabled", label: "Uploads enabled", hint: "Images, files and voice notes can be uploaded" },
    { key: "callsEnabled", label: "Calls enabled", hint: "Call requests can be started" },
    { key: "globalChatEnabled", label: "Global Chat enabled", hint: "The shared room accepts new messages" },
  ];

  return (
    <div className="p-5 sm:p-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Site settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Emergency controls apply instantly, server-side.</p>
      <ErrorNote message={error} />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {switches.map((s) => (
          <Card key={s.key} className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
            </div>
            <Switch
              label={s.label}
              checked={flags ? flags[s.key] : true}
              onChange={(v) => {
                setBusy(s.key);
                void setFlag({ key: s.key, value: v }).finally(() => setBusy(null));
              }}
              disabled={busy === s.key}
            />
          </Card>
        ))}
      </div>

      <Card className="mt-3 p-5">
        <h2 className="font-display font-semibold">Retention policy</h2>
        <p className="mt-1 text-sm text-muted-foreground">Automatically delete files older than the chosen age during sweeps.</p>
        <div className="mt-3 flex max-w-xs items-center gap-2">
          <Select value={retention} onChange={(e) => setRetention(e.target.value)}>
            <option value="0">Keep forever</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
          </Select>
          <Button
            variant="secondary"
            onClick={() => void setFlag({ key: "retentionDays", value: Number(retention) > 0 ? Number(retention) : null })}
          >
            Apply
          </Button>
        </div>
      </Card>

      <Card className="mt-3 p-5">
        <div className="flex items-center gap-2.5">
          <KeyRound className="h-5 w-5 text-accent" />
          <h2 className="font-display font-semibold">Access codes</h2>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input className="max-w-48 font-mono" placeholder="NEW-CODE" value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} />
          <Input className="max-w-64" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button
            variant="accent"
            disabled={newCode.trim().length < 3}
            loading={busy === "code"}
            onClick={async () => {
              setBusy("code");
              setError(null);
              try {
                await upsertCode({ code: newCode, active: true, note: note || undefined });
                setNewCode("");
                setNote("");
              } catch (e) {
                setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Failed");
              } finally {
                setBusy(null);
              }
            }}
          >
            Create / enable
          </Button>
        </div>
        <div className="mt-4 space-y-1.5">
          {(codes ?? []).map((c) => (
            <div key={c._id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="font-mono">{c.code}</span>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                {c.note}
                <Badge tone={c.active ? "success" : "neutral"}>{c.active ? "active" : "inactive"}</Badge>
                {c.uses} uses
                <Switch
                  label={`Toggle ${c.code}`}
                  checked={c.active}
                  onChange={(v) => void upsertCode({ code: c.code, active: v, note: c.note })}
                />
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-3 p-5">
        <div className="flex items-center gap-2.5">
          <LifeBuoy className="h-5 w-5 text-accent" />
          <h2 className="font-display font-semibold">Invite audit trail</h2>
        </div>
        <div className="mt-3 max-h-52 space-y-1 overflow-y-auto text-xs text-muted-foreground">
          {(audit ?? []).slice(0, 30).map((a) => (
            <p key={a._id}>
              {new Date(a.at).toLocaleString()} — {a.action} · {a.code}
              {a.usedByEmail ? ` · ${a.usedByEmail}` : ""}
            </p>
          ))}
        </div>
      </Card>

      <Card className="mt-3 border-warning/40 p-5">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="h-5 w-5 text-warning" />
          <h2 className="font-display font-semibold">Secure creator recovery</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate one-time recovery codes and store them offline. If your account is ever
          locked, any code restores access once and expires.
        </p>
        <Button
          className="mt-3"
          variant="secondary"
          loading={busy === "recovery"}
          onClick={async () => {
            if (!window.confirm("Generate 4 new one-time recovery codes? Old codes stay valid until used.")) return;
            setBusy("recovery");
            try {
              const codes = await genRecovery({});
              setRecoveryCodes(codes as string[]);
            } catch (e) {
              setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Failed");
            } finally {
              setBusy(null);
            }
          }}
        >
          Generate recovery codes
        </Button>
        {recoveryCodes && (
          <div className="mt-4 rounded-lg border border-warning/50 bg-warning/10 p-4">
            <p className="mb-2 text-sm font-medium">Shown once — save them now:</p>
            <div className="grid gap-1.5 font-mono text-sm sm:grid-cols-2">
              {recoveryCodes.map((c) => (
                <span key={c} className="rounded bg-background px-2 py-1">{c}</span>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
