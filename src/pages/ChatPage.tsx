import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  Globe2, ImagePlus, Mic, Paperclip, Pin, Reply, Search, Send, Smile,
  Square, Timer, Trash2, X, Pencil, Flag, Ban,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar, Button, Card, EmptyState, Input, Spinner } from "@/components/ui";
import { cn, formatBytes, formatDuration, formatTime, relativeTime } from "@/lib/utils";
import { PageHeader } from "./AppShell";

const EMOJIS = ["🤍", "🙂", "😮", "😢", "点火".replace("点火", "🔥"), "👀"];

type Draft = { file: File | null };

export function ChatPage({ global = false }: { global?: boolean }) {
  const params = useParams();
  const navigate = useNavigate();
  const conversations = useQuery(api.messaging.listConversations, {});
  const [activeId, setActiveId] = useState<string | null>(
    global ? "global" : (params.conversationId ?? null),
  );
  const activeConv = conversations?.find(
    (c) => c.conversationId === (activeId === "global" ? null : activeId),
  );
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");

  // Auto-select first conversation on wide screens
  useEffect(() => {
    if (!global && !activeId && conversations && conversations.length > 0) {
      // intentionally leave unselected on mobile; select on desktop
      if (window.innerWidth >= 768) setActiveId(conversations[0].conversationId);
    }
  }, [conversations, activeId, global]);

  // Join/ensure global conversation
  const joinGlobal = useMutation(api.messaging.joinGlobalChat);
  useEffect(() => {
    if (global) void joinGlobal({});
  }, [global, joinGlobal]);

  const globalQuery = useQuery(
    api.messaging.globalChatFeed,
    activeId === "global" ? { limit: 60 } : { limit: 1 },
  );
  const globalConversation: Id<"conversations"> | undefined = globalQuery?.conversationId ?? undefined;
  const effectiveId: Id<"conversations"> | null =
    activeId === "global"
      ? ((globalConversation as Id<"conversations"> | undefined) ?? null)
      : (activeConv ? (activeId as Id<"conversations">) : null);

  if (conversations === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const active = conversations.find((c) => c.conversationId === effectiveId);
  const isGlobal = activeId === "global";

  return (
    <div className="flex h-full">
      {/* conversation list */}
      <aside
        className={cn(
          "flex w-full flex-col border-r border-border/70 md:w-72 md:shrink-0",
          (effectiveId || isGlobal) && "hidden md:flex",
        )}
      >
        <PageHeader title={global ? "Global Chat" : "Chats"} />
        <div className="p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search messages…"
              className="pl-8"
              value={globalSearchTerm}
              onChange={(e) => setGlobalSearchTerm(e.target.value)}
              aria-label="Search messages"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {globalSearchTerm.trim().length >= 2 ? (
            <SearchResults term={globalSearchTerm} onOpen={(cid) => { setActiveId(cid); setGlobalSearchTerm(""); }} />
          ) : (
            <>
              {!global && (
                <ConversationButton
                  active={isGlobal}
                  title="Global Chat"
                  preview="Everyone, quietly."
                  icon={<Globe2 className="h-5 w-5" />}
                  onClick={() => setActiveId("global")}
                />
              )}
              {conversations
                .filter((c) => c.kind !== "global" || global)
                .map((c) => (
                  <ConversationButton
                    key={c.conversationId}
                    active={effectiveId === c.conversationId}
                    title={c.title}
                    preview={c.lastMessagePreview || "Say something…"}
                    time={relativeTime(c.lastMessageAt)}
                    unread={c.unread}
                    onClick={() => setActiveId(c.conversationId)}
                  />
                ))}
              {conversations.filter((c) => c.kind !== "global").length === 0 && !global && (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  No conversations yet. Find someone under People.
                </p>
              )}
            </>
          )}
        </div>
      </aside>

      {/* thread */}
      <section className={cn("flex min-w-0 flex-1 flex-col", !effectiveId && !isGlobal && "hidden md:flex")}>
        {isGlobal ? (
          <Thread
            conversationId={globalConversation ?? null}
            title="Global Chat"
            subtitle="The one shared room — moderated"
          />
        ) : effectiveId ? (
          <Thread
            conversationId={effectiveId}
            title={active?.title ?? "Conversation"}
            subtitle={active?.kind === "dm" ? "Direct messages" : "Group"}
            onBack={() => setActiveId(null)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              title="Pick a conversation"
              hint="Your conversations live in the list. Everything you see here stays between the people involved."
            />
          </div>
        )}
      </section>
    </div>
  );
}

function ConversationButton({
  active, title, preview, time, unread, icon, onClick,
}: {
  active: boolean;
  title: string;
  preview: string;
  time?: string;
  unread?: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "focus-ring mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
        active ? "bg-accent/12" : "hover:bg-muted",
      )}
    >
      {icon ?? <Avatar name={title} size="sm" />}
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          {time && <span className="shrink-0 text-[10px] text-muted-foreground">{time}</span>}
        </span>
        <span className={cn("block truncate text-xs", unread ? "font-medium text-foreground" : "text-muted-foreground")}>
          {preview}
        </span>
      </span>
      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="unread" />}
    </button>
  );
}

function SearchResults({ term, onOpen }: { term: string; onOpen: (id: string) => void }) {
  const results = useQuery(api.messaging.searchMessages, { q: term });
  if (results === undefined) return <Spinner className="mx-auto mt-6" />;
  if (results.length === 0)
    return <p className="px-2 py-8 text-center text-sm text-muted-foreground">Nothing found for “{term}”.</p>;
  return (
    <div className="space-y-1">
      {results.map((r) => (
        <button
          key={r._id}
          onClick={() => onOpen(r.conversationId)}
          className="focus-ring block w-full rounded-lg px-3 py-2 text-left hover:bg-muted"
        >
          <p className="text-xs font-medium">{r.conversationTitle} · {r.authorUsername}</p>
          <p className="truncate text-sm text-muted-foreground">{r.body}</p>
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Thread ---

function Thread({
  conversationId,
  title,
  subtitle,
  onBack,
}: {
  conversationId: Id<"conversations"> | null;
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  if (!conversationId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return <ThreadInner conversationId={conversationId} title={title} subtitle={subtitle} onBack={onBack} />;
}

function ThreadInner({
  conversationId,
  title,
  subtitle,
  onBack,
}: {
  conversationId: Id<"conversations">;
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  const messages = useQuery(api.messaging.listMessages, { conversationId, limit: 50 });
  const typing = useQuery(api.messaging.typingIn, { conversationId });
  const pinned = useQuery(api.messaging.pinnedMessages, { conversationId });
  const send = useMutation(api.messaging.sendMessage);
  const edit = useMutation(api.messaging.editMessage);
  const remove = useMutation(api.messaging.deleteMessage);
  const react = useMutation(api.messaging.react);
  const setTyping = useMutation(api.messaging.setTyping);
  const markRead = useMutation(api.messaging.markRead);
  const togglePin = useMutation(api.messaging.togglePin);
  const report = useMutation(api.reports.fileReport);
  const blockUser = useMutation(api.reports.blockUser);

  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [ephemeral, setEphemeral] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [draft, setDraft] = useState<Draft>({ file: null });
  const fileInput = useRef<HTMLInputElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void markRead({ conversationId });
  }, [conversationId, markRead, messages?.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages?.length]);

  const canRecord = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        const secs = recordSecs;
        await uploadAndSend(blob, `voice-${Date.now()}.webm`, "audio/webm", async (storageId) => {
          await send({
            conversationId,
            body: "",
            attachmentId: storageId as Id<"_storage">,
            attachmentType: "audio/webm",
            attachmentName: "Voice message",
            kind: "voice",
            durationMs: Math.max(0, secs) * 1000,
          });
        });
        void secs;
      };
      mediaRecorder.current = mr;
      mr.start();
      setRecording(true);
      setRecordSecs(0);
      const iv: ReturnType<typeof setInterval> = setInterval(() => {
        setRecordSecs((s) => {
          if (s >= 120) {
            stopRecording();
            return s;
          }
          return s + 1;
        });
      }, 1000);
      (mr as unknown as { _iv?: ReturnType<typeof setInterval> })._iv = iv;
    } catch {
      setError("Microphone unavailable");
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorder.current;
    if (mr) {
      const iv = (mr as unknown as { _iv?: ReturnType<typeof setInterval> })._iv;
      if (iv) clearInterval(iv);
      mr.stop();
    }
    setRecording(false);
  };

  const uploadAndSend = async (
    blob: Blob,
    name: string,
    type: string,
    after: (storageId: string) => Promise<void>,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const url = (await apiServerUploadUrl({ name, type, size: blob.size })) as unknown as string;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": type },
        body: blob,
      });
      const { storageId } = (await res.json()) as { storageId: string };
      await after(storageId);
      setDraft({ file: null });
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  // Upload URL comes from the server with permission checks.
  const generateUploadUrl = useMutation(api.files.requestUpload);
  async function apiServerUploadUrl(o: { name: string; type: string; size: number }) {
    return await generateUploadUrl(o);
  }

  const doSend = async () => {
    const text = body.trim();
    if (!text && !draft.file) return;
    setBusy(true);
    setError(null);
    try {
      if (draft.file) {
        await uploadAndSend(draft.file, draft.file.name, draft.file.type, async (storageId) => {
          await send({
            conversationId,
            body: text,
            attachmentId: storageId as Id<"_storage">,
            attachmentName: draft.file!.name,
            attachmentType: draft.file!.type,
            attachmentSize: draft.file!.size,
            replyToId: (replyTo as never) ?? undefined,
            expiresInSeconds: ephemeral ?? undefined,
          });
        });
      } else {
        await send({
          conversationId,
          body: text,
          replyToId: (replyTo as never) ?? undefined,
          expiresInSeconds: ephemeral ?? undefined,
        });
      }
      setBody("");
      setReplyTo(null);
      void setTyping({ conversationId, isTyping: false });
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Uncaught Error: /, "") : "Could not send");
    } finally {
      setBusy(false);
    }
  };

  const onType = (v: string) => {
    setBody(v);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    void setTyping({ conversationId, isTyping: true });
    typingTimer.current = setTimeout(() => {
      void setTyping({ conversationId, isTyping: false });
    }, 2500);
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={title}>
        <span className="hidden text-xs text-muted-foreground sm:block">{subtitle}</span>
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="md:hidden">
            Back
          </Button>
        )}
      </PageHeader>

      {pinned && pinned.length > 0 && (
        <div className="border-b border-border/70 bg-accent/5 px-5 py-2 text-xs text-muted-foreground">
          <Pin className="mr-1.5 inline h-3.5 w-3.5 text-accent" />
          Pinned: {pinned[pinned.length - 1].body.slice(0, 90)}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {messages === undefined ? (
          <div className="flex h-full items-center justify-center"><Spinner /></div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState title="It's quiet here" hint="Nothing has been said yet. The first word is yours." />
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-1">
            {messages.map((m) => (
              <div key={m._id} className={cn("group flex gap-3", m.mine && "flex-row-reverse")}>
                <Avatar name={m.authorUsername} size="sm" className="mt-1" />
                <div className={cn("max-w-[78%]", m.mine && "text-right")}>
                  <div className={cn("mb-0.5 flex items-center gap-2 text-xs text-muted-foreground", m.mine && "justify-end")}>
                    <span className="font-medium text-foreground/80">{m.mine ? "You" : m.authorUsername}</span>
                    <span>{formatTime(m.createdAt)}</span>
                    {m.editedAt && <span className="italic">(edited)</span>}
                  </div>
                  <div
                    className={cn(
                      "inline-block rounded-2xl px-3.5 py-2 text-left text-sm leading-relaxed",
                      m.mine
                        ? "bg-accent text-accent-foreground"
                        : "border border-border bg-card",
                      m.kind === "call" && "bg-transparent border-none px-0",
                    )}
                  >
                    {m.kind === "call" ? (
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {m.callMeta?.kind === "video" ? "🎥" : "📞"}{" "}
                        {m.callMeta?.state === "missed"
                          ? "Missed call"
                          : m.callMeta?.state === "declined"
                            ? "Declined"
                            : `Call ended · ${m.callMeta?.durationSec ?? 0}s`}
                      </span>
                    ) : (
                      <>
                        {m.replyTo && (
                          <span className="mb-1 block rounded-md border-l-2 border-accent/60 bg-background/40 px-2 py-1 text-xs text-muted-foreground">
                            ↩ {m.replyTo.authorUsername}: {m.replyTo.preview}
                          </span>
                        )}
                        {m.attachmentId && m.attachmentType?.startsWith("image/") && (
                          <ImageMessage id={m.attachmentId} conversationId={conversationId} name={m.attachmentName} />
                        )}
                        {m.attachmentId && (m.kind === "voice" || (m.attachmentType?.startsWith("audio/") ?? false)) && (
                          <VoiceMessage id={m.attachmentId} conversationId={conversationId} durationMs={m.durationMs ?? 0} />
                        )}
                        {m.attachmentId && m.attachmentType && !m.attachmentType.startsWith("image/") && !m.attachmentType.startsWith("audio/") && (
                          <FileMessage id={m.attachmentId} conversationId={conversationId} name={m.attachmentName} size={m.attachmentSize} type={m.attachmentType} />
                        )}
                        {m.body && <span className="whitespace-pre-wrap break-words">{m.body}</span>}
                        {m.expiresAt && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] opacity-70">
                            <Timer className="h-3 w-3" />
                            {formatDuration(Math.max(0, m.expiresAt - Date.now()))}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {m.kind !== "call" && (
                    <div className={cn("mt-1 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100", m.mine && "justify-end")}>
                      {Object.entries((m.reactions as { counts: Record<string, number>; mine: string | null }).counts ?? {}).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          onClick={() => void react({ messageId: m._id as never, emoji })}
                          className="focus-ring rounded-full border border-border bg-card px-1.5 py-0.5 text-[11px]"
                          aria-label={`Reaction ${emoji} ${count}`}
                        >
                          {emoji} {count}
                        </button>
                      ))}
                      <button onClick={() => void react({ messageId: m._id as never, emoji: "🤍" })} className="focus-ring rounded p-1 text-muted-foreground hover:text-accent" title="React"><Smile className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setReplyTo(m._id)} className="focus-ring rounded p-1 text-muted-foreground hover:text-accent" title="Reply"><Reply className="h-3.5 w-3.5" /></button>
                      {m.mine && <button onClick={() => { setEditing(m._id); setBody(m.body ?? ""); }} className="focus-ring rounded p-1 text-muted-foreground hover:text-accent" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>}
                      {m.mine ? (
                        <button onClick={() => void remove({ messageId: m._id as never })} className="focus-ring rounded p-1 text-muted-foreground hover:text-destructive" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                      ) : (
                        <>
                          <button
                            onClick={() => void report({ targetType: "message", targetId: m._id, reason: "Reported from chat" })}
                            className="focus-ring rounded p-1 text-muted-foreground hover:text-warning"
                            title="Report"
                          >
                            <Flag className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => void blockUser({ userId: m.authorId as never })}
                            className="focus-ring rounded p-1 text-muted-foreground hover:text-destructive"
                            title="Block user"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {typing && typing.length > 0 && (
              <p className="px-12 text-xs italic text-muted-foreground">{typing.join(", ")} is typing…</p>
            )}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="shrink-0 border-t border-border/70 bg-card/50 px-4 py-3 sm:px-6">
        {error && <p role="alert" className="mb-2 text-xs text-destructive">{error}</p>}
        {replyTo && <ComposerContext label="Replying" onClear={() => setReplyTo(null)} />}
        {editing && (
          <ComposerContext
            label="Editing"
            onClear={() => {
              setEditing(null);
              setBody("");
            }}
          />
        )}
        {draft.file && (
          <ComposerContext label={`Attached: ${draft.file.name}`} onClear={() => setDraft({ file: null })} />
        )}
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            accept="image/*,application/pdf,audio/*,video/*,.txt,.md,.csv,.doc,.docx,.xlsx,.zip"
            onChange={(e) => setDraft({ file: e.target.files?.[0] ?? null })}
            aria-hidden
          />
          <Button variant="ghost" size="icon" title="Attach" onClick={() => fileInput.current?.click()} disabled={busy}>
            {draft.file ? <ImagePlus className="h-5 w-5 text-accent" /> : <Paperclip className="h-5 w-5" />}
          </Button>
          {canRecord && (
            <Button
              variant="ghost"
              size="icon"
              title={recording ? "Stop recording" : "Record voice"}
              onClick={() => (recording ? stopRecording() : startRecording())}
              className={recording ? "text-destructive" : ""}
            >
              {recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            title={ephemeral ? "Disappearing: on" : "Disappearing: off"}
            onClick={() => setEphemeral(ephemeral ? null : 3600)}
            className={ephemeral ? "text-accent" : "text-muted-foreground"}
          >
            <Timer className="h-5 w-5" />
          </Button>
          <Input
            value={body}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (editing) {
                  void edit({ messageId: editing as never, body }).then(() => {
                    setEditing(null);
                    setBody("");
                  });
                } else {
                  void doSend();
                }
              }
            }}
            placeholder={recording ? `Recording… ${recordSecs}s` : "Write something honest…"}
            className="h-11"
            aria-label="Message"
          />
          <Button
            variant="accent"
            size="icon"
            className="h-11 w-11"
            loading={busy}
            onClick={() => {
              if (editing) {
                void edit({ messageId: editing as never, body }).then(() => {
                  setEditing(null);
                  setBody("");
                });
              } else {
                void doSend();
              }
            }}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ComposerContext({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="mx-auto mb-2 flex max-w-3xl items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
      <span className="truncate">{label}</span>
      <button onClick={onClear} className="focus-ring rounded p-0.5 hover:text-foreground" aria-label="Clear">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ------------------------------------------------------------- attachments ---

function ImageMessage({ id, conversationId, name }: { id: string; conversationId?: Id<"conversations">; name?: string | null }) {
  const url = useQuery(api.files.getAttachmentUrl, {
    storageId: id as Id<"_storage">,
    conversationId,
  });
  if (url === undefined) return <div className="h-32 w-48 animate-pulse rounded-lg bg-muted" />;
  if (url === null) return <p className="text-xs text-muted-foreground">[image unavailable]</p>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="focus-ring block overflow-hidden rounded-lg">
      <img src={url} alt={name ?? "image"} className="max-h-72 max-w-full rounded-lg object-cover" loading="lazy" />
    </a>
  );
}

function FileMessage({ id, conversationId, name, size, type }: { id: string; conversationId?: Id<"conversations">; name?: string | null; size?: number | null; type?: string | null }) {
  const url = useQuery(api.files.getAttachmentUrl, {
    storageId: id as Id<"_storage">,
    conversationId,
  });
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="focus-ring mb-1 flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs hover:border-accent/50"
    >
      <Paperclip className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{name ?? "file"}</span>
      <span className="shrink-0 text-muted-foreground">{size ? formatBytes(size) : type}</span>
    </a>
  );
}

function VoiceMessage({ id, conversationId, durationMs }: { id: string; conversationId?: Id<"conversations">; durationMs: number }) {
  const url = useQuery(api.files.getAttachmentUrl, {
    storageId: id as Id<"_storage">,
    conversationId,
  });
  return (
    <div className="flex items-center gap-2 py-1">
      {url ? (
        <audio src={url} controls className="h-9 max-w-[220px]" preload="none" />
      ) : (
        <Spinner className="h-4 w-4" />
      )}
      <span className="text-xs opacity-70">{formatDuration(durationMs)}</span>
    </div>
  );
}
