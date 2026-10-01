import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Camera, KeyRound, LogOut, Trash2, UserRound } from "lucide-react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import {
  Avatar, Button, Card, ErrorNote, Input, Label, Select, Switch, Textarea,
} from "@/components/ui";
import { PageHeader } from "./AppShell";

type Tab = "profile" | "appearance" | "notifications" | "privacy" | "security";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Privacy" },
  { id: "security", label: "Security" },
];

export function SettingsPage() {
  const { profile } = useSession();
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Settings" />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav className="flex gap-1 overflow-x-auto border-b border-border/70 p-3 md:w-52 md:flex-col md:border-b-0 md:border-r" aria-label="Settings sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`focus-ring whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                tab === t.id ? "bg-accent/15 font-medium text-accent" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-xl">
            {tab === "profile" && <ProfileTab />}
            {tab === "appearance" && <AppearanceTab />}
            {tab === "notifications" && <NotificationsTab />}
            {tab === "privacy" && <PrivacyTab />}
            {tab === "security" && <SecurityTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  const { profile } = useSession();
  const update = useMutation(api.profile.updateProfile);
  const requestAvatarUpload = useMutation(api.files.requestAvatarUpload);
  const setAvatar = useMutation(api.files.setAvatar);
  const avatarBase = useQuery(api.profile.getAvatarUrl,
    profile?.avatarStorageId ? { storageId: profile.avatarStorageId } : "skip");
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [statusEmoji, setStatusEmoji] = useState(profile?.statusEmoji ?? "");
  const [statusText, setStatusText] = useState(profile?.statusText ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const uploadAvatar = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const url = await requestAvatarUpload({});
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = (await res.json()) as { storageId: string };
      await setAvatar({ storageId: storageId as never });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Avatar upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2.5">
        <UserRound className="h-5 w-5 text-accent" />
        <h2 className="font-display text-lg font-semibold">Profile</h2>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <Avatar name={profile?.username ?? "?"} src={avatarBase ?? null} size="lg" />
        <label className="focus-ring flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm hover:border-accent/50">
          <Camera className="h-4 w-4" /> Change avatar
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && void uploadAvatar(e.target.files[0])}
          />
        </label>
      </div>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await update({ displayName, bio, statusEmoji, statusText });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          } catch (err) {
            setError(err instanceof Error ? err.message.replace(/^Uncaught Error: /, "") : "Could not save");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <Label>Username (public, fixed)</Label>
          <Input value={profile?.username ?? ""} disabled />
        </div>
        <div>
          <Label htmlFor="dn">Display name</Label>
          <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} placeholder="How should people see you?" />
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={400} placeholder="A few quiet words." />
        </div>
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div>
            <Label htmlFor="se">Emoji</Label>
            <Input id="se" value={statusEmoji} onChange={(e) => setStatusEmoji(e.target.value.slice(0, 4))} placeholder="🌙" />
          </div>
          <div>
            <Label htmlFor="st">Status</Label>
            <Input id="st" value={statusText} onChange={(e) => setStatusText(e.target.value)} maxLength={80} placeholder="Wandering" />
          </div>
        </div>
        <ErrorNote message={error} />
        {saved && <p className="text-sm text-success">Saved.</p>}
        <Button type="submit" variant="accent" loading={busy}>Save profile</Button>
      </form>
    </Card>
  );
}

function AppearanceTab() {
  const { mode, setMode, density, setDensity, motion, setMotion } = useTheme();
  return (
    <Card className="p-6">
      <h2 className="font-display text-lg font-semibold">Appearance</h2>
      <div className="mt-5 space-y-5">
        <div>
          <Label htmlFor="theme">Theme</Label>
          <Select id="theme" value={mode} onChange={(e) => setMode(e.target.value as never)}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">Match system</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="density">Density</Label>
          <Select id="density" value={density} onChange={(e) => setDensity(e.target.value as never)}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="motion">Motion</Label>
          <Select id="motion" value={motion} onChange={(e) => setMotion(e.target.value as never)}>
            <option value="normal">Normal</option>
            <option value="reduced">Reduced</option>
          </Select>
        </div>
      </div>
    </Card>
  );
}

function NotificationsTab() {
  const { profile } = useSession();
  const update = useMutation(api.profile.updateNotificationPrefs);
  const rows: { key: keyof NonNullable<typeof profile>; label: string }[] = [
    { key: "notifyMessages", label: "Messages" },
    { key: "notifyMentions", label: "Mentions (@you)" },
    { key: "notifyCalls", label: "Calls" },
    { key: "notifyGroups", label: "Group invitations" },
    { key: "notifyApprovals", label: "Application updates" },
    { key: "notifyModeration", label: "Moderation actions" },
  ];
  return (
    <Card className="p-6">
      <h2 className="font-display text-lg font-semibold">Notifications</h2>
      <p className="mt-1 text-sm text-muted-foreground">In-app notifications. No email unless asked.</p>
      <div className="mt-5 space-y-4">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between">
            <span className="text-sm">{r.label}</span>
            <Switch
              label={r.label}
              checked={profile?.[r.key] !== false}
              onChange={(v) => void update({ [r.key]: v })}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function PrivacyTab() {
  const { profile } = useSession();
  const update = useMutation(api.profile.updatePrivacyPrefs);
  const [quietUntil, setQuietUntil] = useState("0");
  return (
    <Card className="p-6">
      <h2 className="font-display text-lg font-semibold">Privacy</h2>
      <div className="mt-5 space-y-4">
        <div>
          <Label htmlFor="dmfrom">Direct messages from</Label>
          <Select
            id="dmfrom"
            value={profile?.allowDmFrom ?? "everyone"}
            onChange={(e) => void update({ allowDmFrom: e.target.value as never })}
          >
            <option value="everyone">Anyone in the community</option>
            <option value="nobody">Nobody (off)</option>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Group invitations</span>
          <Switch label="Group invitations" checked={profile?.allowGroupInvites !== false} onChange={(v) => void update({ allowGroupInvites: v })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Show online status</span>
          <Switch label="Online status" checked={profile?.showOnline !== false} onChange={(v) => void update({ showOnline: v })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Show last-active time</span>
          <Switch label="Last active" checked={profile?.showLastActive === true} onChange={(v) => void update({ showLastActive: v })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Read receipts</span>
          <Switch label="Read receipts" checked={profile?.showReadReceipts !== false} onChange={(v) => void update({ showReadReceipts: v })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Typing indicators</span>
          <Switch label="Typing" checked={profile?.showTyping !== false} onChange={(v) => void update({ showTyping: v })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Appear in people directory</span>
          <Switch label="Discoverable" checked={profile?.discoverable !== false} onChange={(v) => void update({ discoverable: v })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Quiet mode (mute notifications)</span>
          <Switch label="Quiet mode" checked={profile?.quietMode === true} onChange={(v) => void update({ quietMode: v })} />
        </div>
        <div>
          <Label htmlFor="qmode">Quiet mode duration</Label>
          <Select id="qmode" value={quietUntil} onChange={(e) => setQuietUntil(e.target.value)}>
            <option value="0">Until I turn it off</option>
            <option value="1">For 1 hour</option>
            <option value="8">For 8 hours</option>
          </Select>
        </div>
      </div>
    </Card>
  );
}

function SecurityTab() {
  const { profile } = useSession();
  const changePassword = useMutation(api.profile.changePassword);
  const signOutEverywhere = useMutation(api.profile.signOutEverywhere);
  const deleteAccount = useMutation(api.profile.deleteAccount);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  void profile;

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center gap-2.5">
          <KeyRound className="h-5 w-5 text-accent" />
          <h2 className="font-display text-lg font-semibold">Change password</h2>
        </div>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy("pw");
            setError(null);
            setNotice(null);
            try {
              await changePassword({ currentPassword: current, newPassword: next });
              setNotice("Password changed. Other sessions were signed out.");
              setCurrent("");
              setNext("");
            } catch (err) {
              setError(err instanceof Error ? err.message.replace(/^Uncaught Error: /, "") : "Could not change password");
            } finally {
              setBusy(null);
            }
          }}
        >
          <div>
            <Label htmlFor="cp">Current password</Label>
            <Input id="cp" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <Label htmlFor="np">New password (min 8 chars)</Label>
            <Input id="np" type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </div>
          <ErrorNote message={error} />
          {notice && <p className="text-sm text-success">{notice}</p>}
          <Button type="submit" variant="accent" loading={busy === "pw"}>Update password</Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold">Sessions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign out everywhere — including this device. You will need to sign in again.
        </p>
        <Button
          className="mt-4"
          variant="secondary"
          loading={busy === "so"}
          onClick={async () => {
            setBusy("so");
            try {
              await signOutEverywhere({});
              await authClient.signOut();
              window.location.href = "/";
            } catch (e) {
              setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Failed");
            } finally {
              setBusy(null);
            }
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out everywhere
        </Button>
      </Card>

      <Card className="border-destructive/30 p-6">
        <div className="flex items-center gap-2.5">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="font-display text-lg font-semibold">Delete account</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently removes your membership. Data export first is recommended (Privacy Center).
        </p>
        <Button
          className="mt-4"
          variant="danger"
          loading={busy === "del"}
          onClick={async () => {
            if (!window.confirm("Delete your account permanently? This cannot be undone.")) return;
            setBusy("del");
            try {
              await deleteAccount({});
              window.location.href = "/";
            } catch (e) {
              setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Failed");
            } finally {
              setBusy(null);
            }
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete my account
        </Button>
      </Card>
    </div>
  );
}
