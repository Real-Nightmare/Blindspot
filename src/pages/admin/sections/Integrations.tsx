import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Bot, Mail, PhoneCall, Plug, Scale, Save, CloudUpload } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button, Card, ErrorNote, Input, Label, Switch } from "@/components/ui";

type IntegrationSpec = {
  key: string;
  label: string;
  category: string;
  icon: React.ReactNode;
  hint: string;
  configFields: { name: string; label: string; placeholder?: string }[];
  secretFields: { name: string; label: string; secret?: boolean }[];
};

const CATALOG: IntegrationSpec[] = [
  {
    key: "ai_provider",
    label: "AI Provider",
    category: "AI",
    icon: <Bot className="h-5 w-5" />,
    hint: "Powers the AI Builder. OpenAI-compatible endpoint (OpenAI, Azure, Ollama, OpenRouter…).",
    configFields: [
      { name: "baseUrl", label: "Base URL", placeholder: "https://api.openai.com/v1" },
      { name: "model", label: "Model", placeholder: "gpt-4o-mini" },
    ],
    secretFields: [{ name: "apiKey", label: "API key" }],
  },
  {
    key: "email",
    label: "Transactional Email",
    category: "Email",
    icon: <Mail className="h-5 w-5" />,
    hint: "Sends verification / notification email when configured. Without it, email features stay off honestly.",
    configFields: [
      { name: "from", label: "From address", placeholder: "Blindspot <no-reply@yourdomain>" },
    ],
    secretFields: [{ name: "apiKey", label: "API key (Resend-compatible)" }],
  },
  {
    key: "realtime",
    label: "Realtime / Calling",
    category: "Calling",
    icon: <PhoneCall className="h-5 w-5" />,
    hint: "Reserved for WebRTC signaling (e.g. LiveKit). Until configured, calls record lifecycle only.",
    configFields: [{ name: "baseUrl", label: "Provider URL", placeholder: "https://your.livekit.cloud" }],
    secretFields: [{ name: "apiKey", label: "API key" }, { name: "apiSecret", label: "API secret" }],
  },
  {
    key: "storage",
    label: "Storage / CDN",
    category: "Storage",
    icon: <CloudUpload className="h-5 w-5" />,
    hint: "Blindspot uses Convex file storage by default. Add an external CDN later for large media.",
    configFields: [{ name: "cdnUrl", label: "CDN base URL" }],
    secretFields: [{ name: "apiKey", label: "API key" }],
  },
  {
    key: "moderation",
    label: "Content Moderation API",
    category: "Moderation",
    icon: <Scale className="h-5 w-5" />,
    hint: "Optional automated screening for Global Chat. Human review always stays available.",
    configFields: [{ name: "baseUrl", label: "Endpoint URL" }],
    secretFields: [{ name: "apiKey", label: "API key" }],
  },
];

export function IntegrationsSection() {
  const saved = useQuery(api.settings.listIntegrations, {});
  const save = useMutation(api.settings.saveIntegration);
  const [drafts, setDrafts] = useState<Record<string, { enabled: boolean; config: Record<string, string>; secrets: Record<string, string> }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Seed drafts from saved values once loaded.
  useEffect(() => {
    if (!saved) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const spec of CATALOG) {
        const doc = saved.find((s) => s.key === spec.key);
        if (!next[spec.key]) {
          next[spec.key] = {
            enabled: doc?.enabled ?? false,
            config: { ...(doc?.config as Record<string, string> | undefined) },
            secrets: { ...(doc?.maskedSecrets as Record<string, string> | undefined) },
          };
        }
      }
      return next;
    });
  }, [saved]);

  const submit = async (spec: IntegrationSpec) => {
    setBusy(spec.key);
    setError(null);
    setNotice(null);
    try {
      const d = drafts[spec.key] ?? { enabled: false, config: {}, secrets: {} };
      await save({
        key: spec.key,
        label: spec.label,
        category: spec.category,
        enabled: d.enabled,
        config: d.config,
        secrets: d.secrets,
      });
      setNotice(`${spec.label} saved.`);
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Save failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-5 sm:p-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Integrations & API keys</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Keys are stored server-side and never sent to the browser — saved values appear
        masked here. Nothing is hardcoded in the app; every integration degrades gracefully
        when unconfigured.
      </p>
      <ErrorNote message={error} />
      {notice && <p className="mt-2 text-sm text-success">{notice}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {CATALOG.map((spec) => {
          const d = drafts[spec.key];
          return (
            <Card key={spec.key} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-accent/10 p-2.5 text-accent">{spec.icon}</span>
                  <div>
                    <p className="font-medium">{spec.label}</p>
                    <p className="text-xs text-muted-foreground">{spec.category}</p>
                  </div>
                </div>
                <Switch
                  label={`${spec.label} enabled`}
                  checked={d?.enabled ?? false}
                  onChange={(v) => setDrafts((p) => ({ ...p, [spec.key]: { ...p[spec.key], enabled: v, config: p[spec.key]?.config ?? {}, secrets: p[spec.key]?.secrets ?? {} } }))}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{spec.hint}</p>
              <div className="mt-4 space-y-3">
                {spec.configFields.map((f) => (
                  <div key={f.name}>
                    <Label htmlFor={`${spec.key}-${f.name}`}>{f.label}</Label>
                    <Input
                      id={`${spec.key}-${f.name}`}
                      placeholder={f.placeholder}
                      value={d?.config?.[f.name] ?? ""}
                      onChange={(e) =>
                        setDrafts((p) => ({
                          ...p,
                          [spec.key]: {
                            enabled: p[spec.key]?.enabled ?? false,
                            config: { ...(p[spec.key]?.config ?? {}), [f.name]: e.target.value },
                            secrets: p[spec.key]?.secrets ?? {},
                          },
                        }))
                      }
                    />
                  </div>
                ))}
                {spec.secretFields.map((f) => (
                  <div key={f.name}>
                    <Label htmlFor={`${spec.key}-${f.name}`}>{f.label}</Label>
                    <Input
                      id={`${spec.key}-${f.name}`}
                      type="password"
                      placeholder={d?.secrets?.[f.name] ? "saved ••••" : ""}
                      value={d?.secrets?.[f.name] ?? ""}
                      onChange={(e) =>
                        setDrafts((p) => ({
                          ...p,
                          [spec.key]: {
                            enabled: p[spec.key]?.enabled ?? false,
                            config: p[spec.key]?.config ?? {},
                            secrets: { ...(p[spec.key]?.secrets ?? {}), [f.name]: e.target.value },
                          },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <Button className="mt-4" variant="secondary" loading={busy === spec.key} onClick={() => submit(spec)}>
                <Save className="h-4 w-4" /> Save {spec.label}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4 p-5">
        <div className="flex items-center gap-2.5">
          <Plug className="h-5 w-5 text-accent" />
          <h2 className="font-display font-semibold">Environment variable fallback</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Server actions also read standard env vars (e.g. <code className="rounded bg-muted px-1">AI_API_KEY</code>,{" "}
          <code className="rounded bg-muted px-1">EMAIL_API_KEY</code>) when present, so deployments can
          configure secrets outside the dashboard. Values set here always take precedence.
        </p>
      </Card>
    </div>
  );
}
