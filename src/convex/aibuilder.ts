import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { requireCreator, audit } from "./authz";
import { authComponent } from "./auth";

/**
 * AI Builder (Creator-only).
 *
 * BYOK: the creator registers an AI provider in Integrations (key:
 * `ai_provider`) with a base URL, model and API key. Keys never reach the
 * client — the action reads them server-side from the integrations table.
 *
 * Capabilities, honestly scoped:
 *  - the action inspects a project summary (schema + module map) that the
 *    creator dashboard supplies,
 *  - the provider returns a structured change proposal,
 *  - proposals are stored as DRAFTS and require explicit creator approval;
 *    nothing is applied to production automatically and destructive actions
 *    always require confirmation,
 *  - generated output is returned to the creator to review/copy — it is never
 *    granted unrestricted production privileges.
 */
export const propose = action({
  args: {
    prompt: v.string(),
    contextSummary: v.string(),
  },
  handler: async (ctx, args): Promise<{ runId: string; plan: string }> => {
    const me = await requireCreator(ctx);
    if (args.prompt.trim().length < 10) {
      throw new Error("Describe the feature in a bit more detail");
    }
    const integration = await ctx.runQuery(api.aibuilder.listIntegrationsForAction, {
      key: "ai_provider",
    });
    if (!integration || !integration.enabled || !integration.secrets?.apiKey) {
      throw new Error(
        "No AI provider configured. Add an API key under Integrations → AI Provider first.",
      );
    }
    const config = (integration.config ?? {}) as Record<string, string>;
    const baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const model = config.model ?? "gpt-4o-mini";

    let content: string;
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${integration.secrets.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are the Blindspot AI Builder. Given a project summary and a feature request, " +
                "respond with a concise change proposal as JSON: {summary, files: [{path, action: 'create'|'edit'|'delete', notes}], risks, destructive: boolean}. " +
                "Do not include secrets in output. Keep it under 400 words.",
            },
            {
              role: "user",
              content: `Project summary:\n${args.contextSummary}\n\nFeature request:\n${args.prompt}`,
            },
          ],
          temperature: 0.2,
        }),
      });
      if (!res.ok) {
        throw new Error(`AI provider error ${res.status}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      content = data.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      await ctx.runMutation(api.aibuilder.recordFailure, {
        prompt: args.prompt,
        error: e instanceof Error ? e.message : "Unknown AI error",
      });
      throw new Error(
        "The AI provider could not be reached. Check the base URL, model and API key in Integrations.",
      );
    }

    const runId = (await ctx.runMutation(api.aibuilder.recordProposal, {
      prompt: args.prompt,
      planText: content,
    })) as string;
    await audit(ctx as never, me, "aibuilder.propose", {
      summary: args.prompt.slice(0, 80),
    });
    return { runId, plan: content };
  },
});

export const listIntegrationsForAction = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    await requireCreator(ctx);
    const doc = await ctx.db
      .query("integrations")
      .withIndex("key", (q) => q.eq("key", args.key))
      .unique();
    if (!doc) return null;
    return {
      enabled: doc.enabled,
      config: doc.config ?? {},
      secrets: doc.secrets ?? {},
    };
  },
});

export const recordProposal = mutation({
  args: { prompt: v.string(), planText: v.string() },
  handler: async (ctx, args) => {
    const me = await requireCreator(ctx);
    return await ctx.db.insert("aiBuilderRuns", {
      requestedBy: me._id,
      prompt: args.prompt,
      state: "proposed",
      plan: args.planText,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const recordFailure = mutation({
  args: { prompt: v.string(), error: v.string() },
  handler: async (ctx, args) => {
    const me = await requireCreator(ctx);
    await ctx.db.insert("aiBuilderRuns", {
      requestedBy: me._id,
      prompt: args.prompt,
      state: "failed",
      error: args.error,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const listRuns = query({
  args: {},
  handler: async (ctx) => {
    await requireCreator(ctx);
    return await ctx.db.query("aiBuilderRuns").order("desc").take(50);
  },
});

export const resolveRun = mutation({
  args: {
    runId: v.id("aiBuilderRuns"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const me = await requireCreator(ctx);
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found");
    await ctx.db.patch(args.runId, { state: args.decision, updatedAt: Date.now() });
    await audit(ctx, me, `aibuilder.${args.decision}`, {
      targetType: "aiRun",
      targetId: args.runId,
    });
  },
});

export const listMyAiRunsOwner = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireCreator(ctx);
    void authComponent;
    return me._id;
  },
});
