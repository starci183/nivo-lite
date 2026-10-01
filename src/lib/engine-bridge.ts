import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { translator } from "@/i18n/core";
import { engine as engineDict } from "@/i18n/dict/engine";
import { system } from "@/i18n/dict/system";
import { ingest, logEvidence } from "./core";
import { channelOf, completeQueuedTurn, ENGINE_ACTOR } from "./customer-turn";
import * as ai from "./deepseek";
import type { EngineJob } from "./engine-queue";
import { loadAuthority, runWork, type EngineCtx } from "./engine";
import { drainAfter } from "./flow-ctx";
import { buildAgentContext } from "./knowledge/index";
import { knowledgeBrief } from "./knowledge/runtime";
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

/** The reply contract the model is held to. Mirrors the one inline customerChat uses (deepseek.ts), so both processors answer in one shape. */
const REPLY_CONTRACT = `You are talking to a CUSTOMER on the company's chat (website or Telegram). Reply in the customer's language, max 80 words.
When the customer has shared their need AND their name (company, phone or email if possible), set "lead" (otherwise null).
If the customer asks for a price, discount, deadline or any commitment that is not clearly allowed by the business knowledge and authority, or you are not sure of the answer:
set "needs_human": true, "reason": "over_authority" (commitment or price) or "unclear_outcome" (unsure), put in "proposed_answer" ONLY facts found in the business knowledge (never invent a discount, gift, price or policy; if the knowledge has no answer set "proposed_answer": null), written as the FINAL message to the customer, as if the owner has already approved it (warm, concrete, no mention of approval, owner or internal checks), and make "reply" answer what you are allowed to and say politely that the team will confirm the rest shortly: in "reply" never state the discount, gift or commitment itself.
Asking to be contacted, called back or advised, sharing a need or contact details, and general questions answered by the business knowledge are ROUTINE: capture the lead and answer yourself with "needs_human": false.
Otherwise "needs_human": false, "reason": null, "proposed_answer": null.
ORDER: judge ONLY the customer's latest message. When it clearly commits to buy an item whose price is WRITTEN in the business knowledge, set "order": {"items": the item name as written, "amount_vnd": the total price in VND as an integer copied from the knowledge}. In "reply" thank them, repeat the item and price, and say the payment details follow; do not say it is paid. If the item or its price is not in the knowledge: "order": null, "needs_human": true, "reason": "over_authority". Otherwise "order": null.
PAYMENT CLAIM: when the customer says they have already paid or transferred the money, set "payment_claim": true, "needs_human": false, and in "reply" thank them and say the shop will check the transfer and confirm shortly. Never say the payment is received. Otherwise "payment_claim": false.
Your FINAL message must be ONLY this JSON object, nothing else:
{"reply": string, "lead": null | {"contact_name","company","need","phone","email"}, "needs_human": boolean, "reason": "over_authority"|"unclear_outcome"|null, "proposed_answer": string|null, "order": null | {"items": string, "amount_vnd": integer}, "payment_claim": boolean}
Your reply is only a PROPOSAL: NIVO checks it against the owner's authority before anything reaches the customer.`;

const HISTORY_TURNS = 20;

/** Everything the engine needs to run one chat.turn: the system context (authority, approved knowledge, PUBLIC business knowledge only) and the transcript. */
export const chatTurnContext = async (db: SupabaseClient, job: EngineJob) => {
  const ws = job.workspace_id;
  const conv = must(await db.from("agent_conversations").select("*").eq("id", payloadId(job, "conversation_id")).eq("workspace_id", ws).single<AgentConversation>());
  const agent = must(await db.from("agents").select("*").eq("id", conv.agent_id).eq("workspace_id", ws).single<Agent>());
  const mine = must(await db.from("agent_messages").select("*").eq("id", payloadId(job, "message_id")).eq("conversation_id", conv.id).single<AgentMessage>());
  const history = ((await db.from("agent_messages").select("*").eq("conversation_id", conv.id).order("created_at")).data ?? []) as Array<AgentMessage>;
  const turns = history.filter((m) => m.role !== "system").slice(-HISTORY_TURNS).map((m) => ({ role: m.role === "user" ? "user" : "agent", body: m.body }));
  const c = ctxOf(db, ws);
  const brief = ai.authorityBrief(await loadAuthority(c)) + (await knowledgeBrief(c, agent.module, mine.body, "customer"));
  const persona = `You are ${agent.name} (@${agent.handle}), role: ${agent.role}.\nInstructions: ${agent.instructions}\nBusiness knowledge: ${agent.knowledge || "(none)"}\nApproval rule: ${agent.approval_rule || "Commitments need human approval."}`;
  return {
    conversation_id: conv.id, message_id: mine.id, module: agent.module, agent_name: agent.name, handled_by: conv.handled_by ?? null,
    customer_message: mine.body, turns,
    system: `You work inside NIVO OS, a responsibility operating system for founder-led service SMEs in Vietnam. Act within the authority the owner granted; ask when data is missing, the action is over the limit, or the outcome is unclear.\n${persona}${brief}\n\n${REPLY_CONTRACT}`,
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
  };
};

export type CallbackBody = { readonly op: "chat.reply"; readonly text: string } | { readonly op: "chat.fallback"; readonly reason: string };

/**
 * The engine hands back its proposed reply (chat.reply) or reports it could not get one (chat.fallback: the app answers with the default
 * processor). Idempotent per job: a retried callback is a no-op, so a customer never gets two replies.
 */
export const chatTurnCallback = async (db: SupabaseClient, job: EngineJob, body: CallbackBody): Promise<{ applied: boolean; fallback: boolean; duplicate: boolean }> => {
  const receipt = await db.from("channel_receipts").insert({ workspace_id: job.workspace_id, channel: "engine", receipt_id: `chat.turn:${job.id}` });
  if (receipt.error) {
    if (receipt.error.code === "23505") return { applied: false, fallback: false, duplicate: true };
    throw new Error(receipt.error.message);
  }
  try {
    const c = ctxOf(db, job.workspace_id);
    const done = await completeQueuedTurn(c, {
      conversationId: payloadId(job, "conversation_id"), messageId: payloadId(job, "message_id"), eventId: payloadId(job, "event_id"),
      proposed: body.op === "chat.reply" ? readProposedReply(body.text) : null,
    });
    await logEvidence(db, job.workspace_id, {
      kind: done.fallback ? "engine.fallback" : "engine.reply", actor: ACTOR,
      summary: done.fallback ? `OpenClaw unavailable (${body.op === "chat.fallback" ? body.reason.slice(0, 120) : "no answer"}): answered with the default processor` : done.applied ? "OpenClaw proposed the reply; it passed the authority gate" : "Conversation was taken over by a person: no AI reply",
      evidence: job.id,
    });
    drainAfter(c, 3);
    return { ...done, duplicate: false };
  } catch (e) {
    await db.from("channel_receipts").delete().eq("workspace_id", job.workspace_id).eq("channel", "engine").eq("receipt_id", `chat.turn:${job.id}`);
    throw e;
  }
};

/* ------------------------------------------------------------------ tools (OpenClaw -> engine -> here) */

export const TOOL_NAMES = ["knowledge.search", "lead.create_or_update", "approval.request", "handoff.to_person"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export const isToolName = (v: unknown): v is ToolName => typeof v === "string" && (TOOL_NAMES as ReadonlyArray<string>).includes(v);

/** Run one tool for the job's own conversation. Nothing here reads a workspace or conversation id from `args`. */
export const runEngineTool = async (db: SupabaseClient, job: EngineJob, tool: ToolName, args: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const ws = job.workspace_id;
  const c = ctxOf(db, ws);
  const t = translator(system, "vi");
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
