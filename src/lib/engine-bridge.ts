import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { translator } from "@/i18n/core";
import { engine as engineDict } from "@/i18n/dict/engine";
import { system } from "@/i18n/dict/system";
import { ingest, logEvidence } from "./core";
import { channelOf, completeQueuedTurn, ENGINE_ACTOR } from "./customer-turn";
import * as ai from "./deepseek";
import { replyTimeoutSec, type EngineJob } from "./engine-queue";
import { loadAuthority, runWork, type EngineCtx } from "./engine";
import { drainAfter } from "./flow-ctx";
import { buildAgentContext } from "./knowledge/index";
import { knowledgeBrief } from "./knowledge/runtime";
import { buildAgentBundle, installationOfJob, REPLY_CONTRACT } from "./engine-sync";
import { BOOKING_REPLY_ADDENDUM } from "./module-booking-contract";
import { bookingContextLine } from "./module-booking";
import { BOOKING_TOOL_NAMES, handleBookingReply, runBookingTool, type BookingToolName } from "./module-booking-chat";
import { readChatApplication } from "./module-hiring-contract";
import { hiringChatBrief } from "./module-hiring-flow";
import { loyaltyChatBlock } from "./module-loyalty-chat";
import { recordEngineUsage, type UsageKind, type UsageModule } from "./usage";
import { escalateToStaff } from "./staff-relay";
import type { Agent, AgentConversation, AgentMessage } from "./types";

/**
 * What the engine may ask of the app, one function per signed call (route: /api/engine/[op]). Every function receives the JOB, never a
 * workspace id from the caller: the workspace, conversation and message are the job's own. The engine proposes; the app decides:
 * a proposed reply, a lead or an approval request all go through the same gate, evidence log and delivery as the default path.
 */

const ACTOR = ENGINE_ACTOR;
const must = <T>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new Error("Not found");
  return res.data;
};
const ctxOf = (db: SupabaseClient, ws: string): EngineCtx => ({ db, ws, actor: ACTOR, locale: "vi" });
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const payloadId = (job: EngineJob, key: string): string => {
  const v = job.payload[key];
  if (typeof v !== "string" || v.length === 0) throw new Error(`job payload has no ${key}`);
  return v;
};

/* ------------------------------------------------------------------ context */

const HISTORY_TURNS = 20;

/** Everything the engine needs to run one chat.turn: the system context (authority, approved knowledge, PUBLIC business knowledge only) and the transcript. */
export const chatTurnContext = async (db: SupabaseClient, job: EngineJob) => {
  const ws = job.workspace_id;
  const c = ctxOf(db, ws);
  // Everything that only needs the job payload runs together; what needs the conversation's agent runs together after it (this call is on the customer's critical path).
  const [conv, mine, history, authorityRaw] = await Promise.all([
    db.from("agent_conversations").select("*").eq("id", payloadId(job, "conversation_id")).eq("workspace_id", ws).single<AgentConversation>().then(must),
    db.from("agent_messages").select("*").eq("id", payloadId(job, "message_id")).eq("conversation_id", payloadId(job, "conversation_id")).single<AgentMessage>().then(must),
    db.from("agent_messages").select("*").eq("conversation_id", payloadId(job, "conversation_id")).order("created_at").then((r) => (r.data ?? []) as Array<AgentMessage>),
    loadAuthority(c),
  ]);
  const agent = must(await db.from("agents").select("*").eq("id", conv.agent_id).eq("workspace_id", ws).single<Agent>());
  const turns = history.filter((m) => m.role !== "system").slice(-HISTORY_TURNS).map((m) => ({ role: m.role === "user" ? "user" : "agent", body: m.body }));
  // Is the agent's OpenClaw copy (AGENTS.md, SOUL.md, knowledge/) current? Then only the dynamic data goes into the turn.
  const [inst, dynamic] = await Promise.all([
    db.from("module_installations").select("id, active_context_version_id, settings").eq("workspace_id", ws).eq("agent_id", agent.id).maybeSingle(),
    buildAgentContext({ workspaceId: ws, module: agent.module, query: mine.body, audience: "customer", db, scope: "dynamic" }),
  ]);
  const instRow = inst.data as { id: string; active_context_version_id: string | null; settings: Record<string, unknown> | null } | null;
  const [versionRes, syncRes] = await Promise.all([
    instRow?.active_context_version_id ? db.from("module_context_versions").select("version").eq("id", instRow.active_context_version_id).maybeSingle() : Promise.resolve({ data: null }),
    instRow ? db.from("openclaw_agent_sync").select("status, context_version, synced_at").eq("installation_id", instRow.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const activeVersion = (versionRes.data as { version: number } | null)?.version ?? null;
  const syncRow = syncRes.data as { status: string; context_version: number | null; synced_at: string | null } | null;
  const synced = syncRow !== null && syncRow.status === "ok" && syncRow.synced_at !== null;
  const slim = synced && syncRow.context_version === activeVersion;
  const authority = ai.authorityBrief(authorityRaw) + (agent.module === "booking" ? await bookingContextLine(ws) : "") + (await hiringChatBrief(db, ws)); // booking: today, services, hours, policy; hiring: open jobs for the chat
  // Loyalty module installed: the member's points, tier and the reward catalogue (from the ledger) plus the contract addition for a redeem request.
  const loyalty = agent.module === "chatbot" ? await loyaltyChatBlock(db, ws, conv).catch(() => "") : "";
  const base = {
    conversation_id: conv.id, message_id: mine.id, module: agent.module, agent_name: agent.name, handled_by: conv.handled_by ?? null,
    customer_message: mine.body, turns, installation_id: instRow?.id ?? null, timeout_ms: replyTimeoutSec(instRow?.settings) * 1000, synced, mode: slim ? "slim" : "full",
  };
  if (slim) {
    // Only what changes per turn: the owner's current authority and the passages closest to this question (PUBLIC only). Rules, persona,
    // active context version, tone and the reply contract are in the agent's synced workspace files.
    const passages = dynamic.system;
    return {
      ...base,
      system: `Your persona, NIVO rules, the approved context, the tone and the reply contract are in your workspace (AGENTS.md, SOUL.md): follow them.${authority}${passages ? `

[RETRIEVED PASSAGES]
${passages}` : ""}${loyalty ? `

${loyalty}` : ""}

Answer with ONLY the JSON object of the reply contract in AGENTS.md.`,
    };
  }
  const brief = authority + (await knowledgeBrief(c, agent.module, mine.body, "customer"));
  const persona = `You are ${agent.name} (@${agent.handle}), role: ${agent.role}.
Instructions: ${agent.instructions}
Business knowledge: ${agent.knowledge || "(none)"}
Approval rule: ${agent.approval_rule || "Commitments need human approval."}`;
  return {
    ...base,
    system: `You work inside NIVO OS, a responsibility operating system for founder-led service SMEs in Vietnam. Act within the authority the owner granted; ask when data is missing, the action is over the limit, or the outcome is unclear.
${persona}${brief}${loyalty ? `

${loyalty}` : ""}

${agent.module === "booking" ? `${REPLY_CONTRACT}
${BOOKING_REPLY_ADDENDUM}` : REPLY_CONTRACT}`,
  };
};

/* ------------------------------------------------------------------ the proposed reply */

const parseJsonLoose = (raw: string): Record<string, unknown> | null => {
  const body = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const v: unknown = JSON.parse(s);
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const whole = tryParse(body);
  if (whole) return whole;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? tryParse(body.slice(start, end + 1)) : null;
};

const validOrder = (o: unknown): ai.CustomerChatOut["order"] => {
  if (!o || typeof o !== "object") return null;
  const { items, amount_vnd } = o as { items?: unknown; amount_vnd?: unknown };
  const amount = typeof amount_vnd === "number" ? amount_vnd : typeof amount_vnd === "string" ? Number(amount_vnd.replace(/[^\d]/g, "")) : NaN;
  if (typeof items !== "string" || !items.trim() || !Number.isFinite(amount) || amount <= 0) return null;
  return { items: items.trim(), amount_vnd: Math.round(amount) };
};

const readLoyalty = (v: unknown): ai.CustomerChatOut["loyalty"] => {
  if (!v || typeof v !== "object") return null;
  const { intent, reward_key } = v as { intent?: unknown; reward_key?: unknown };
  return intent === "redeem" && typeof reward_key === "string" && reward_key.trim() ? { intent: "redeem", reward_key: reward_key.trim().slice(0, 40) } : null;
};

/**
 * Read the engine's proposed reply as the same structure the inline model returns. An answer that is not the JSON object (a model that
 * ignored the contract) is never sent to the customer as-is: it becomes a proposed answer for a person to approve, with a fixed holding line.
 */
export const readProposedReply = (raw: string): ai.CustomerChatOut => {
  const obj = parseJsonLoose(raw);
  const reply = typeof obj?.reply === "string" ? obj.reply.trim() : "";
  if (!obj || !reply) {
    return { reply: translator(engineDict, "vi")("holdingReply"), lead: null, needs_human: true, reason: "unclear_outcome", proposed_answer: raw.trim().slice(0, 1500) || null, order: null, payment_claim: false };
  }
  const lead = obj.lead && typeof obj.lead === "object" ? (obj.lead as Record<string, unknown>) : null;
  const needsHuman = obj.needs_human === true;
  return {
    reply,
    lead: lead && text(lead.contact_name, 120) && text(lead.need, 600)
      ? { contact_name: text(lead.contact_name, 120), company: text(lead.company, 120), need: text(lead.need, 600), phone: text(lead.phone, 40) || null, email: text(lead.email, 120) || null }
      : null,
    needs_human: needsHuman,
    reason: obj.reason === "over_authority" || obj.reason === "unclear_outcome" ? obj.reason : needsHuman ? "unclear_outcome" : null,
    proposed_answer: typeof obj.proposed_answer === "string" && obj.proposed_answer.trim() ? obj.proposed_answer.trim() : null,
    order: validOrder(obj.order),
    payment_claim: obj.payment_claim === true,
    application: readChatApplication(obj.application),
    loyalty: readLoyalty(obj.loyalty),
  };
};

/** What the engine reports about one OpenClaw run: provider usage (tokens, cached tokens, cost) and where the time went. */
export type RunUsage = { readonly prompt_tokens?: number; readonly completion_tokens?: number; readonly cached_tokens?: number; readonly cost?: number; readonly model?: string };
export type RunTimings = Record<string, number>;

export type CallbackBody =
  | { readonly op: "chat.reply"; readonly text: string; readonly usage?: RunUsage | null; readonly timings?: RunTimings | null }
  | { readonly op: "chat.fallback"; readonly reason: string }
  | { readonly op: "generate.result"; readonly text: string; readonly usage?: RunUsage | null; readonly timings?: RunTimings | null }
  | { readonly op: "generate.error"; readonly reason: string; readonly timings?: RunTimings | null };

/**
 * The engine hands back its proposed reply (chat.reply) or reports it could not get one (chat.fallback: the app answers with the default
 * processor). Idempotent per job: a retried callback is a no-op, so a customer never gets two replies.
 */
export const chatTurnCallback = async (db: SupabaseClient, job: EngineJob, body: Extract<CallbackBody, { op: "chat.reply" | "chat.fallback" }>): Promise<{ applied: boolean; fallback: boolean; duplicate: boolean }> => {
  const receipt = await db.from("channel_receipts").insert({ workspace_id: job.workspace_id, channel: "engine", receipt_id: `chat.turn:${job.id}` });
  if (receipt.error) {
    if (receipt.error.code === "23505") return { applied: false, fallback: false, duplicate: true };
    throw new Error(receipt.error.message);
  }
  try {
    const c = ctxOf(db, job.workspace_id);
    // No proposed reply (the engine said it could not, or the sweeper cancelled the job): no AI text is written. holdingTurn sends the fixed holding line,
    // hands the question to a person and records "fallback: openclaw_unavailable" itself.
    const done = await completeQueuedTurn(c, {
      conversationId: payloadId(job, "conversation_id"), messageId: payloadId(job, "message_id"), eventId: payloadId(job, "event_id"),
      proposed: body.op === "chat.reply" ? readProposedReply(body.text) : null, reason: "openclaw_unavailable",
    });
    // booking: a structured booking_request in the proposed reply becomes gated actions (src/lib/module-booking-chat.ts); the reply itself was already applied above.
    if (body.op === "chat.reply" && done.applied && !done.fallback) await handleBookingReply(db, job, body.text);
    if (!done.fallback && done.applied) {
      await logEvidence(db, job.workspace_id, { kind: "engine.reply", actor: ACTOR, summary: "OpenClaw proposed the reply; it passed the authority gate", evidence: job.id });
      if (body.op === "chat.reply") await recordEngineUsage({ workspaceId: job.workspace_id, kind: "chat_reply", module: "chatbot", model: body.usage?.model, usage: body.usage ?? undefined });
    } else if (!done.applied) {
      await logEvidence(db, job.workspace_id, { kind: "engine.reply", actor: ACTOR, summary: "Conversation was taken over by a person: no AI reply", evidence: job.id });
    }
    drainAfter(c, 3);
    return { ...done, duplicate: false };
  } catch (e) {
    await db.from("channel_receipts").delete().eq("workspace_id", job.workspace_id).eq("channel", "engine").eq("receipt_id", `chat.turn:${job.id}`);
    throw e;
  }
};

/* ------------------------------------------------------------------ openclaw.generate (every other text the app writes) */

type GenerationRow = { id: string; workspace_id: string; purpose: string; module: string; usage_kind: string; status: string; input: { messages?: Array<{ role: string; content: string }>; response_format?: string; timeout_ms?: number } };

/** What the engine needs to run one generation: the prompt messages the app wrote. The row is the JOB's own (workspace and id come from the job payload). */
export const generateInput = async (db: SupabaseClient, job: EngineJob) => {
  const row = must(await db.from("ai_generations").select("*").eq("id", payloadId(job, "generation_id")).eq("workspace_id", job.workspace_id).single<GenerationRow>());
  if (row.status !== "queued" && row.status !== "running") throw new Error(`generation is ${row.status}`);
  await db.from("ai_generations").update({ status: "running" }).eq("id", row.id).eq("status", "queued");
  return { workspace_id: row.workspace_id, purpose: row.purpose, messages: row.input.messages ?? [], response_format: row.input.response_format === "json" ? "json" : "text", timeout_ms: row.input.timeout_ms ?? 45_000 };
};

/** The engine's result for a generation. Results for a cancelled generation (the caller timed out) are dropped; metering records the ones that count. */
export const generateCallback = async (db: SupabaseClient, job: EngineJob, body: Extract<CallbackBody, { op: "generate.result" | "generate.error" }>): Promise<{ applied: boolean }> => {
  const id = payloadId(job, "generation_id");
  const now = new Date().toISOString();
  const patch = body.op === "generate.result"
    ? { status: "done", output: { text: body.text }, usage: body.usage ?? null, timings: body.timings ?? {}, finished_at: now }
    : { status: "error", error: body.reason.slice(0, 300), timings: body.timings ?? {}, finished_at: now };
  const { data } = await db.from("ai_generations").update(patch).eq("id", id).eq("workspace_id", job.workspace_id).in("status", ["queued", "running"]).select("usage_kind, module").maybeSingle();
  if (!data) return { applied: false };
  if (body.op === "generate.result") {
    const row = data as { usage_kind: string; module: string };
    await recordEngineUsage({ workspaceId: job.workspace_id, kind: row.usage_kind as UsageKind, module: row.module as UsageModule, model: body.usage?.model, usage: body.usage ?? undefined, completionChars: body.text.length });
  }
  return { applied: true };
};

/* ------------------------------------------------------------------ tools (OpenClaw -> engine -> here) */

export const TOOL_NAMES = ["knowledge.search", "lead.create_or_update", "approval.request", "handoff.to_person", ...BOOKING_TOOL_NAMES] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export const isToolName = (v: unknown): v is ToolName => typeof v === "string" && (TOOL_NAMES as ReadonlyArray<string>).includes(v);

/** Run one tool for the job's own conversation. Nothing here reads a workspace or conversation id from `args`. */
export const runEngineTool = async (db: SupabaseClient, job: EngineJob, tool: ToolName, args: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const ws = job.workspace_id;
  const c = ctxOf(db, ws);
  const t = translator(system, "vi");
  if ((BOOKING_TOOL_NAMES as ReadonlyArray<string>).includes(tool)) return runBookingTool(db, job, tool as BookingToolName, args); // booking lane: booking.find_slots / booking.request
  const conv = must(await db.from("agent_conversations").select("*").eq("id", payloadId(job, "conversation_id")).eq("workspace_id", ws).single<AgentConversation>());
  const trace = (summary: string, evidence?: string) => logEvidence(db, ws, { lead_id: conv.lead_id, kind: `engine.tool.${tool}`, actor: ACTOR, summary, evidence: evidence ?? job.id });

  if (tool === "knowledge.search") {
    const query = text(args.query, 400);
    if (!query) throw new Error("query is required");
    // Customer audience: PUBLIC business knowledge only, filtered in SQL.
    const { system: block, citations } = await buildAgentContext({ workspaceId: ws, module: "chatbot", query, audience: "customer", db, limit: 6 });
    await trace(`Knowledge search: ${query.slice(0, 100)}`);
    return { passages: block, citations: citations.map((x) => ({ title: x.title, topic: x.topic })) };
  }

  if (tool === "lead.create_or_update") {
    const name = text(args.contact_name, 120);
    const need = text(args.need, 600);
    if (!name || !need) throw new Error("contact_name and need are required");
    // A conversation already tied to a lead is not rewritten from a chat tool: it is the owner's record.
    if (conv.lead_id) return { lead_id: conv.lead_id, status: "exists" };
    const contact = text(args.phone, 40) || text(args.email, 120) || null;
    const channel = channelOf(conv);
    const { event, duplicate } = await ingest(db, ws, {
      channel: channel.key, kind: "lead", origin: "live", sender_name: name, sender_contact: contact, body: need, amount_vnd: null, external_ref: conv.id, event_id: `engine:${job.id}:lead`,
    }, (n) => t("duplicateBlocked", { n }));
    if (duplicate) return { lead_id: null, status: "duplicate" };
    const item = await runWork(c, {
      action: "handoff_lead", subject_type: "conversation", subject_id: conv.id, inbound_event_id: event.id, origin: "live", dedupeKey: `handoff_lead:conversation:${conv.id}`,
      seed: { fields: { contact_name: name, company: text(args.company, 120), need, contact, channel_label: channel.label, conversation_id: conv.id } },
    });
    await db.from("agent_conversations").update({ visitor_name: name, ...(item.lead_id ? { lead_id: item.lead_id } : {}) }).eq("id", conv.id);
    await trace(`Lead handed to Sales through the gate (${item.status})`, event.id);
    drainAfter(c, 2);
    return { lead_id: item.lead_id, status: item.status };
  }

  if (tool === "approval.request") {
    const question = text(args.question, 500);
    if (!question) throw new Error("question is required");
    const proposed = text(args.proposed_answer, 1500) || null;
    const reason = args.reason === "unclear_outcome" ? "unclear_outcome" : "over_authority";
    const item = await runWork(c, {
      action: "reply_customer", subject_type: "conversation", subject_id: conv.id, lead_id: conv.lead_id, origin: "live",
      dedupeKey: `reply_customer:engine:${job.id}`, preset: true, noChain: true, forceAsk: reason,
      seed: { summary: t("replySummary", { question: question.slice(0, 160) }), draft: proposed ?? "", fields: { question, conversation_id: conv.id } },
    });
    if (item.status === "waiting_decision") {
      await escalateToStaff(c, { workItemId: item.id, conversationId: conv.id, customerName: conv.visitor_name ?? "—", question, proposed });
    }
    await trace(`Approval requested from the owner (${item.status})`, item.id);
    return { work_item_id: item.id, status: item.status };
  }

  // handoff.to_person: from now on the AI stays quiet in this conversation until a person hands it back.
  const reason = text(args.reason, 300);
  await db.from("agent_conversations").update({ handled_by: ACTOR, handled_at: new Date().toISOString() }).eq("id", conv.id).eq("workspace_id", ws);
  await db.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv.id, role: "system", body: t("chatNeedsHuman") });
  await trace("Conversation handed to a person", reason || undefined);
  return { status: "handed_to_person" };
};

/* ------------------------------------------------------------------ the OpenClaw copy of an agent */

/** The files the engine writes into the agent's OpenClaw workspace, built only from Supabase. Callable from a sync job, or from a chat.turn job whose agent has no copy yet. */
export const syncBundle = async (db: SupabaseClient, job: EngineJob) => buildAgentBundle(db, job.workspace_id, await installationOfJob(db, job));

/* ------------------------------------------------------------------ the outage sweeper */

/**
 * Called every minute (pg_cron -> pg_net -> /api/engine/sweep). engine_sweep_claim() cancels, atomically, chat.turn jobs that waited more than 30 s in
 * the queue or ran past their deadline; from then on the engine cannot answer them (its callbacks find no running job). Each one is answered here with the
 * direct model, exactly like a fallback the engine reports, and recorded as "fallback: engine_timeout". Idempotent per job (channel receipt).
 */
export const sweepEngineTimeouts = async (db: SupabaseClient): Promise<{ swept: number; answered: number; failed: number }> => {
  const { data, error } = await db.rpc("engine_sweep_claim");
  if (error) throw new Error(error.message);
  const jobs = (data ?? []) as Array<EngineJob>;
  let answered = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      const r = await chatTurnCallback(db, job, { op: "chat.fallback", reason: "openclaw_unavailable" });
      if (r.applied || r.duplicate) answered++;
    } catch (e) {
      failed++;
      console.error("sweep fallback failed:", job.id, e instanceof Error ? e.message : e);
    }
  }
  return { swept: jobs.length, answered, failed };
};
