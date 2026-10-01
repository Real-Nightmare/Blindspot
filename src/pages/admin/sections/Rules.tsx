import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Badge, Button, Card, ErrorNote, Input, Label, Spinner, Switch, Textarea } from "@/components/ui";

export function RulesSection() {
  const rules = useQuery(api.rules.allRules, {});
  const save = useMutation(api.rules.saveRule);
  const toggle = useMutation(api.rules.setRuleDisabled);
  const reorder = useMutation(api.rules.reorderRules);
  const del = useMutation(api.rules.deleteRule);
  const [editing, setEditing] = useState<{ id?: string; title: string; body: string; order: number; published: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Rules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every edit creates a version. Reordering renumbers rules; applicants always accept the current set.
          </p>
        </div>
        <Button variant="accent" onClick={() => setEditing({ title: "", body: "", order: (rules?.length ?? 0) + 1, published: true })}>
          <Plus className="h-4 w-4" /> New rule
        </Button>
      </div>
      <ErrorNote message={error} />

      {editing && (
        <Card className="mt-5 p-5">
          <h2 className="font-display font-semibold">{editing.id ? "Edit rule" : "New rule"}</h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await save({
                  ruleId: editing.id as never,
                  title: editing.title,
                  body: editing.body,
                  order: editing.order,
                  published: editing.published,
                });
                setEditing(null);
              } catch (err) {
                setError(err instanceof Error ? err.message.replace(/^Uncaught Error: /, "") : "Save failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div>
              <Label htmlFor="rt">Title</Label>
              <Input id="rt" required minLength={3} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="rb">Body</Label>
              <Textarea id="rb" required rows={5} minLength={3} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                Order
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  value={editing.order}
                  onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                Published
                <Switch label="Published" checked={editing.published} onChange={(v) => setEditing({ ...editing, published: v })} />
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="accent" loading={busy}>Save</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="mt-5 space-y-2">
        {rules === undefined ? (
          <Spinner className="mx-auto mt-10" />
        ) : rules.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No rules yet. Until at least one rule is published, registration cannot be completed.
          </Card>
        ) : (
          rules.map((r, i) => (
            <Card key={r._id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {r.order}. {r.title}{" "}
                  {!r.published && <Badge tone="neutral">draft</Badge>}
                  {r.disabled && <Badge tone="warning">disabled</Badge>}
                </p>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" title="Move up" disabled={i === 0}
                  onClick={() => {
                    const ids = rules.map((x) => x._id as never);
                    [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                    void reorder({ orderedIds: ids });
                  }}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Move down" disabled={i === rules.length - 1}
                  onClick={() => {
                    const ids = rules.map((x) => x._id as never);
                    [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
                    void reorder({ orderedIds: ids });
                  }}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Edit" onClick={() => setEditing({ id: r._id, title: r.title, body: r.body, order: r.order, published: r.published })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title={r.disabled ? "Enable" : "Disable"} onClick={() => void toggle({ ruleId: r._id as never, disabled: !r.disabled })}>
                  {r.disabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" title="Delete"
                  onClick={() => {
                    if (window.confirm(`Delete rule “${r.title}”? Version history is removed too.`)) {
                      void del({ ruleId: r._id as never });
                    }
                  }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
