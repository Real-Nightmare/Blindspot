import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Circle, Plus, Settings2, UserPlus } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Avatar, Badge, Button, Card, EmptyState, ErrorNote, Input, Label, Select } from "@/components/ui";
import { PageHeader } from "./AppShell";
import { useSession } from "@/lib/session";

export function GroupsPage() {
  const { profile } = useSession();
  const groups = useQuery(api.groups.listGroups, {});
  const create = useMutation(api.groups.createGroup);
  const respond = useMutation(api.groups.respondToInvite);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [disappearing, setDisappearing] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Groups">
        <Button size="sm" variant="accent" onClick={() => setCreating((c) => !c)}>
          <Plus className="h-4 w-4" /> New group
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {creating && (
            <Card className="p-5">
              <h2 className="font-display text-lg font-semibold">Create a group</h2>
              <form
                className="mt-4 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError(null);
                  try {
                    await create({
                      name,
                      description,
                      isPrivate,
                      inviteOnly: true,
                      allowFiles: true,
                      allowVoice: true,
                      disappearingSeconds: Number(disappearing) > 0 ? Number(disappearing) : undefined,
                    });
                    setCreating(false);
                    setName("");
                    setDescription("");
                  } catch (err) {
                    setError(err instanceof Error ? err.message.replace(/^Uncaught Error: /, "") : "Could not create group");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div>
                  <Label htmlFor="gname">Name</Label>
                  <Input id="gname" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Night owls" />
                </div>
                <div>
                  <Label htmlFor="gdesc">Description</Label>
                  <Input id="gdesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this circle about?" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="gpriv">Visibility</Label>
                    <Select id="gpriv" value={isPrivate ? "private" : "unlisted"} onChange={(e) => setIsPrivate(e.target.value === "private")}>
                      <option value="private">Private — invite only</option>
                      <option value="unlisted">Discoverable by invite</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="gdisp">Messages disappear</Label>
                    <Select id="gdisp" value={disappearing} onChange={(e) => setDisappearing(e.target.value)}>
                      <option value="0">Never (default)</option>
                      <option value="3600">After 1 hour</option>
                      <option value="86400">After 1 day</option>
                      <option value="604800">After 1 week</option>
                    </Select>
                  </div>
                </div>
                <ErrorNote message={error} />
                <Button type="submit" variant="accent" className="w-full" loading={busy}>
                  Create group
                </Button>
              </form>
            </Card>
          )}

          {groups === undefined ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Fetching circles…</p>
          ) : groups.length === 0 ? (
            <EmptyState
              title="No groups yet"
              hint="Groups are small circles with their own privacy settings. Create one, or wait for an invitation."
            />
          ) : (
            groups.map((g) => (
              <Card key={g._id} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={g.name} size="md" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{g.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{g.description ?? "No description"}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {g.state === "invited" ? (
                      <>
                        <Button size="sm" variant="accent" onClick={() => void respond({ groupId: g._id as never, accept: true })}>
                          Join
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void respond({ groupId: g._id as never, accept: false })}>
                          Decline
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge tone={g.isPrivate ? "warning" : "neutral"}>
                          {g.isPrivate ? "Private" : "Invite"} · {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                        </Badge>
                        {g.disappearingSeconds && <Badge tone="accent"><Circle className="mr-1 inline h-3 w-3" />ephemeral</Badge>}
                        <span className="text-xs text-muted-foreground">{g.myRole}</span>
                      </>
                    )}
                  </div>
                </div>
                {g.state === "active" && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Settings2 className="h-3.5 w-3.5" />
                    Files {g.allowFiles ? "allowed" : "off"} · Voice {g.allowVoice ? "allowed" : "off"}
                    {g.slowModeSeconds ? ` · slow mode ${g.slowModeSeconds}s` : ""}
                  </p>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
