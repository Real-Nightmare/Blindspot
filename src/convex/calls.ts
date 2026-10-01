import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireApproved, assertConversationParticipant } from "./authz";

/**
 * Call signaling.
 *
 * Blindspot records call *lifecycle* (who called, voice/video, missed/ended).
 * The media path itself requires WebRTC with a signaling channel and TURN
 * infrastructure. Convex websockets cannot relay SDP offers with the current
 * component set, so 1:1 media connections are not attempted here — the UI
 * presents call requests + notifications honestly and records outcomes.
 * When a signaling provider is configured in Integrations (e.g. LiveKit),
 * `startCall` should be extended to mint provider tokens.
 */
export const startCall = mutation({
  args: {
    conversationId: v.id("conversations"),
    kind: v.union(v.literal("voice"), v.literal("video")),
  },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    await assertConversationParticipant(ctx, args.conversationId, me._id);
    const flags = await ctx.db.query("siteSettings").collect();
    if (flags.some((f) => f.key === "callsEnabled" && f.value === false)) {
      throw new Error("Calls are currently disabled");
    }
    const callId = await ctx.db.insert("calls", {
      conversationId: args.conversationId,
      initiatorId: me._id,
      kind: args.kind,
      state: "ringing",
      startedAt: Date.now(),
    });
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      authorId: me._id,
      kind: "call",
      callMeta: { kind: args.kind, state: "started" },
    });
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
      lastMessagePreview: args.kind === "voice" ? "📞 Voice call" : "🎥 Video call",
    });
    return callId;
  },
});

export const endCall = mutation({
  args: {
    callId: v.id("calls"),
    state: v.union(v.literal("ended"), v.literal("missed"), v.literal("declined")),
  },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    const call = await ctx.db.get(args.callId);
    if (!call) throw new Error("Call not found");
    await assertConversationParticipant(ctx, call.conversationId, me._id);
    await ctx.db.patch(args.callId, {
      state: args.state,
      endedAt: Date.now(),
    });
    const durationSec = Math.round((Date.now() - call.startedAt) / 1000);
    await ctx.db.insert("messages", {
      conversationId: call.conversationId,
      authorId: call.initiatorId,
      kind: "call",
      callMeta: { kind: call.kind, state: args.state, durationSec },
    });
  },
});

export const activeCall = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const me = await requireApproved(ctx);
    await assertConversationParticipant(ctx, args.conversationId, me._id);
    const calls = await ctx.db
      .query("calls")
      .withIndex("conversationId", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(5);
    return calls.find((c) => c.state === "ringing" || c.state === "active") ?? null;
  },
});
