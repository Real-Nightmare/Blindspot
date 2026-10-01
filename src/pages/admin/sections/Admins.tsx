import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Avatar, Badge, Button, Card, ErrorNote, Spinner } from "@/components/ui";
import { ADMIN_PERMISSIONS_CLIENT } from "./permissions";

export function AdminsSection() {
  const admins = useQuery(api.admin.listAdmins, {});
  const candidates = useQuery(api.admin.listUsers, { status: "approved", limit: 200 });
  const grants = useQuery(api.admin.listVerificationAccess, {});
  const createAdmin = useMutation(api.admin.createAdmin);
  const updatePerms = useMutation(api.admin.updateAdminPermissions);
  const removeAdmin = useMutation(api.admin.removeAdmin);
  const grant = useMutation(api.admin.grantVerificationAccess);
  const revoke = useMutation(api.admin.revokeVerificationAccess);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (p: string) =>
    setPicked((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const adminIds = new Set((admins ?? []).map((a) => a._id));
  const promotable = (candidates ?? []).filter((u) => !adminIds.has(u._id));

  return (
    <div className="p-5 sm:p-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Admins</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Grant scoped permissions. Verification access is separate and explicit — admins never get it automatically.
      </p>
      <ErrorNote message={error} />

      <Card className="mt-6 p-5">
        <h2 className="font-display font-semibold">Promote a member</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="focus-ring h-10 flex-1 rounded-lg border border-input bg-card px-2 text-sm"
            aria-label="Choose member"
          >
            <option value="">Choose an approved member…</option>
            {promotable.map((u) => (
              <option key={u._id} value={u._id}>{u.username}</option>
            ))}
          </select>
          <Button
            variant="accent"
            disabled={!selected || picked.length === 0}
            loading={busy === "create"}
            onClick={() =>
              run("create", async () => {
                await createAdmin({ userId: selected as never, permissions: picked });
                setSelected("");
                setPicked([]);
              })
            }
          >
            Grant admin
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ADMIN_PERMISSIONS_CLIENT.map((p) => (
            <button
              key={p}
              onClick={() => toggle(p)}
              className={`focus-ring rounded-full px-3 py-1 text-xs transition-colors ${
                picked.includes(p) ? "bg-accent font-medium text-accent-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </Card>

      {admins === undefined ? (
        <Spinner className="mx-auto mt-10" />
      ) : (
        <div className="mt-4 space-y-3">
          {admins.map((a) => (
            <Card key={a._id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={a.username} size="sm" />
                  <div>
                    <p className="text-sm font-medium">{a.username}</p>
                    <p className="text-xs text-muted-foreground">{a.email}</p>
                  </div>
                  <Badge tone={a.role === "creator" ? "accent" : "neutral"}>{a.role}</Badge>
                </div>
                {a.role === "admin" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" loading={busy === `v-${a._id}`} onClick={() => run(`v-${a._id}`, () => (a.canVerification ? revoke({ adminUserId: a._id as never }) : grant({ adminUserId: a._id as never })))}>
                      {a.canVerification ? "Revoke verification access" : "Grant verification access"}
                    </Button>
                    <Button size="sm" variant="danger" loading={busy === `r-${a._id}`} onClick={() => run(`r-${a._id}`, () => removeAdmin({ userId: a._id as never }))}>
                      Remove admin
                    </Button>
                  </div>
                )}
              </div>
              {a.role === "admin" && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ADMIN_PERMISSIONS_CLIENT.map((p) => {
                    const on = a.permissions.includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() =>
                          run(`p-${a._id}-${p}`, () =>
                            updatePerms({
                              userId: a._id as never,
                              permissions: on ? a.permissions.filter((x) => x !== p) : [...a.permissions, p],
                            }),
                          )
                        }
                        className={`focus-ring rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                          on ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground/60 hover:text-foreground"
                        }`}
                        title={on ? "Click to revoke" : "Click to grant"}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-4 p-5">
        <h2 className="font-display font-semibold">Verification access grants</h2>
        {grants === undefined ? (
          <Spinner className="mt-3" />
        ) : grants.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Only the creator can see verification data right now.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {grants.map((g) => (
              <li key={g._id} className="rounded-lg bg-muted px-3 py-1.5">@{g.username}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
