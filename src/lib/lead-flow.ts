import "server-only";
import { logEvidence, type Db } from "./core";
import { sendCommand } from "./agent-commands";
import { runWork, type EngineCtx } from "./engine";
import { escalateToStaff } from "./staff-relay";
import { factsForView } from "./brain/facts";
import { agentsFor } from "./agent-bindings";
import { lastUserMessageAt, loadMetaPage, sendInstagramMessage, sendMessage, type MetaPage } from "./meta";
import type { MetaFailure, MetaPlatform } from "./meta-core";
import {
  DEFAULT_CRITERIA, lines, parseCriteria, parseQuestions, setupKindOf, windowStatus,
  type Analysis, type Answer, type Criteria, type EscalationReason, type FlowState, type Identity, type LeadSource, type Level, type Locale, type Signals,
} from "./lead-flow-rules";
import type { FlowAction, Origin, WorkItem } from "./flow-types";
import type { Agent, AgentConversation } from "./types";

/**
 * The lead flow, server side (lead_gen). lead-flow-rules.ts holds every decision that needs no I/O; this file reads and writes `lead_flows`,
 * talks to Meta through meta.ts, hands a person the conversation, and chains the module's own commands after each step:
 *
 *   capture_lead -> score_lead -> greet_prospect | ask_qualifying | handoff_to_sales | follow_up_lead | close_lead
 *   comment      -> score_lead -> reply_comment_public -> private_reply_comment
 *   any step     -> escalate (reply_customer, forced ask) when a person is needed, and the bot goes silent
 *
 * Every command is the module's own work item through the authority gate (agent-commands.ts); nothing here talks to a customer outside it,
 * except the fixed one-line hand-over notice that accompanies an escalation (the same as the chatbot's holding line).
 */

/** Who the conversation is "handled by" while a person must take over: the bot is silent until they hand it back. */
export const LEAD_GEN_ACTOR = "NIVO · Lead Gen";

export type FlowRow = {
  id: string; workspace_id: string; lead_id: string | null; connection_id: string | null; conversation_id: string | null;
  platform: MetaPlatform | null; psid: string | null; igsid: string | null; phone: string | null; email: string | null; name: string | null;
  state: FlowState; resume_state: FlowState | null;
  source: Partial<LeadSource>; touches: Array<LeadSource>; answers: Array<Answer>; asked: number; pending_question: number | null; contact_asked_at: string | null;
  signals: Partial<Signals>; score: Level | null; score_reasons: Array<string>; scored_at: string | null; analysis: Analysis | null;
  last_user_at: string | null; last_user_text: string | null;
  greeted_at: string | null; handed_off_at: string | null; followed_up_at: string | null; closed_at: string | null; escalated_at: string | null; escalation_reason: string | null;
  created_at: string; updated_at: string;
};

export const str = (v: unknown): string => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
export const loc = (c: EngineCtx): Locale => (c.locale === "en" ? "en" : "vi");
export const pick = (c: EngineCtx, vi: string, en: string): string => (c.locale === "en" ? en : vi);
export const now = (): string => new Date().toISOString();

/* ------------------------------------------------------------------ the lead_flows table */

export const flowByLead = async (db: Db, ws: string, leadId: string | null): Promise<FlowRow | null> =>
  leadId ? (((await db.from("lead_flows").select("*").eq("workspace_id", ws).eq("lead_id", leadId).maybeSingle()).data ?? null) as FlowRow | null) : null;

export const mustFlow = async (c: EngineCtx, leadId: string | null): Promise<FlowRow> => {
  const f = await flowByLead(c.db, c.ws, leadId);
  if (!f) throw new Error(pick(c, "Khách này chưa có luồng Tạo lead.", "This lead has no lead-gen flow."));
  return f;
};

/** Candidate flows for an identity (any key matches); matchFlow picks the strongest. */
export const flowCandidates = async (db: Db, ws: string, id: Identity): Promise<Array<FlowRow>> => {
  const ors = [id.psid && `psid.eq.${id.psid}`, id.igsid && `igsid.eq.${id.igsid}`, id.phone && `phone.eq.${id.phone}`, id.email && `email.eq.${id.email}`].filter(Boolean) as Array<string>;
  if (!ors.length) return [];
  const { data } = await db.from("lead_flows").select("*").eq("workspace_id", ws).or(ors.join(",")).order("created_at").limit(20);
  return (data ?? []) as Array<FlowRow>;
};

export const patchFlow = async (db: Db, id: string, patch: Partial<Record<keyof FlowRow, unknown>>): Promise<FlowRow> => {
  const { data, error } = await db.from("lead_flows").update({ ...patch, updated_at: now() }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as FlowRow;
};

/** The workspace's lead_gen agent (oldest active one). */
export const leadGenAgent = async (c: Pick<EngineCtx, "db" | "ws">, connectionId?: string | null): Promise<Agent | null> => {
  if (connectionId) {
    const bound = (await agentsFor(connectionId, "lead_source", { acting: true, modules: ["lead_gen"] }).catch(() => []))[0];
    if (bound) {
      const row = ((await c.db.from("agents").select("*").eq("workspace_id", c.ws).eq("id", bound.id).maybeSingle()).data ?? null) as Agent | null;
      if (row) return row;
    }
  }
  return (((await c.db.from("agents").select("*").eq("workspace_id", c.ws).eq("module", "lead_gen").eq("status", "active").order("created_at").limit(1)).data ?? [])[0] ?? null) as Agent | null;
};

/* ------------------------------------------------------------------ the owner's setup (Second Brain facts) */

export type FlowSetup = { readonly questions: ReadonlyArray<string>; readonly criteriaText: string; readonly criteria: Criteria; readonly icpText: string };

/**
 * The owner's qualification questions (at most 4) and hot / warm / cold criteria, from the facts the setup gates wrote
 * (module.json gates "qualification" and "icp_area"). Read internally as configuration: only the questions themselves ever reach a customer.
 */
export const flowSetup = async (c: Pick<EngineCtx, "db" | "ws">): Promise<FlowSetup> => {
  let questions: Array<string> = [];
  let criteriaText = "";
  let icpText = "";
  try {
    const facts = await factsForView(c.db, c.ws, "internal", "lead_gen");
    const first = (kind: "questions" | "criteria" | "icp") => facts.find((f) => setupKindOf(f.attribute) === kind)?.value ?? "";
    questions = parseQuestions(first("questions"));
    criteriaText = first("criteria");
    icpText = first("icp");
  } catch (e) {
    console.error("lead flow: setup facts unreadable:", e instanceof Error ? e.message : e);
  }
  return { questions, criteriaText, criteria: criteriaText ? parseCriteria(criteriaText, icpText) : DEFAULT_CRITERIA, icpText };
};

/* ------------------------------------------------------------------ the conversation (the transcript and the hand-over switch) */

export const ensureConversation = async (
  c: Pick<EngineCtx, "db" | "ws">, a: { flow: Pick<FlowRow, "platform" | "connection_id" | "lead_id" | "name">; externalId: string; agentId: string },
): Promise<AgentConversation> => {
  const channel = a.flow.platform ?? "facebook";
  const found = ((await c.db.from("agent_conversations").select("*").eq("workspace_id", c.ws).eq("channel", channel).eq("external_id", a.externalId).maybeSingle()).data ?? null) as AgentConversation | null;
  if (found) {
    const patch: Record<string, unknown> = {};
    if (found.agent_id !== a.agentId) patch.agent_id = a.agentId;
    if (a.flow.lead_id && !found.lead_id) patch.lead_id = a.flow.lead_id;
    if (Object.keys(patch).length) await c.db.from("agent_conversations").update(patch).eq("id", found.id);
    return { ...found, ...patch } as AgentConversation;
  }
  const created = await c.db.from("agent_conversations").insert({
    workspace_id: c.ws, agent_id: a.agentId, kind: "customer", channel, external_id: a.externalId, visitor_name: a.flow.name,
    connection_id: a.flow.connection_id, lead_id: a.flow.lead_id,
  }).select().single();
  if (created.error) throw new Error(created.error.message);
  return created.data as AgentConversation;
};

export const sayInConversation = async (db: Db, ws: string, conversationId: string | null, role: "agent" | "system" | "user", body: string, delivery?: "sent" | "failed", error?: string | null): Promise<void> => {
  if (!conversationId || !body.trim()) return;
  await db.from("agent_messages").insert({
    workspace_id: ws, conversation_id: conversationId, role, body,
    ...(delivery ? { delivery_status: delivery, delivery_error: delivery === "failed" ? error ?? "failed" : null } : {}),
  });
};

/* ------------------------------------------------------------------ sending to a person on Meta (the 24 hour window is enforced twice: here and in meta.ts) */

export type DmOutcome =
  | { readonly ok: true; readonly ids: ReadonlyArray<string> }
  | { readonly ok: false; readonly reason: "window" | "tag_only" | "no_recipient" | MetaFailure; readonly detail?: string };

/** Where the 24 hour window of this person stands right now (ms since their last message). */
export const flowWindow = async (flow: Pick<FlowRow, "connection_id" | "platform" | "psid" | "igsid">) => {
  const id = flow.platform === "instagram" ? flow.igsid : flow.psid;
  if (!flow.connection_id || !flow.platform || !id) return windowStatus(null, Date.now());
  return windowStatus(await lastUserMessageAt(flow.connection_id, flow.platform, id).catch(() => null), Date.now());
};

/**
 * Send one direct message to the person of a flow. Without `tag` only inside the 24 hour window; with tag "HUMAN_AGENT" (the ask-mode action
 * message_with_human_agent_tag) up to 7 days. Never throws on a refusal: the reason comes back. The text is stored in the conversation.
 */
export const sendToFlow = async (
  c: Pick<EngineCtx, "db" | "ws">, flow: Pick<FlowRow, "connection_id" | "platform" | "psid" | "igsid" | "conversation_id">, text: string, opts: { readonly tag?: "HUMAN_AGENT"; readonly page?: MetaPage | null } = {},
): Promise<DmOutcome> => {
  const platform = flow.platform ?? "facebook";
  const recipient = platform === "instagram" ? flow.igsid : flow.psid;
  if (!recipient) return { ok: false, reason: "no_recipient" };
  if (!flow.connection_id) return { ok: false, reason: "not_connected" };
  const w = await flowWindow(flow);
  if (!opts.tag && w.status !== "open") return { ok: false, reason: w.status === "tag_only" ? "tag_only" : "window" };
  if (opts.tag && w.status === "closed") return { ok: false, reason: "window" };
  const page = opts.page ?? (await loadMetaPage(flow.connection_id).catch(() => null));
  if (!page || page.workspaceId !== c.ws) return { ok: false, reason: "not_connected" };
  const res = await (platform === "instagram" ? sendInstagramMessage : sendMessage)(page, recipient, text, opts.tag ? { tag: opts.tag } : {});
  await sayInConversation(c.db, c.ws, flow.conversation_id, "agent", text, res.ok ? "sent" : "failed", res.ok ? null : `meta_${res.reason}`);
  return res.ok ? { ok: true, ids: res.ids } : { ok: false, reason: res.reason, detail: res.detail };
};

/* ------------------------------------------------------------------ escalation: a person takes over, the bot stops */

const REASON_VI: Readonly<Record<EscalationReason, string>> = {
  complaint: "khiếu nại", refund: "đòi hoàn tiền", angry: "khách bực bội", real_person: "hỏi có phải người thật không",
  low_confidence: "độ tin cậy thấp hoặc tri thức chưa trả lời được", negative_comment: "bình luận tiêu cực công khai", unreadable: "không đọc được tin (tệp đính kèm hoặc AI không phản hồi)",
};
const REASON_EN: Readonly<Record<EscalationReason, string>> = {
  complaint: "complaint", refund: "refund request", angry: "angry customer", real_person: "asked whether this is a real person",
  low_confidence: "low confidence or no answer in the knowledge", negative_comment: "negative public comment", unreadable: "message unreadable (attachment or AI unavailable)",
};
export const reasonText = (c: Pick<EngineCtx, "locale">, r: EscalationReason): string => (c.locale === "en" ? REASON_EN : REASON_VI)[r];

/**
 * A person takes this lead: the flow becomes `escalated` (resume_state keeps where it was), the conversation is handled by LEAD_GEN_ACTOR so
 * the bot is silent until a person hands it back (the chatbot's "take over" switch), the staff member is asked in Office about `item` (a waiting
 * work item), and a DM gets one honest line that a colleague takes over (inside the 24 hour window only; a comment gets nothing here).
 */
export const holdForPerson = async (
  c: EngineCtx, a: { readonly flow: FlowRow; readonly reason: EscalationReason; readonly item: WorkItem; readonly question: string; readonly proposed?: string | null; readonly notify?: boolean },
): Promise<FlowRow> => {
  const { flow, reason, item } = a;
  const name = flow.name ?? pick(c, "Khách", "Customer");
  if (item.status === "waiting_decision") {
    await escalateToStaff(c, { workItemId: item.id, conversationId: flow.conversation_id ?? "", customerName: name, question: `${a.question} [${reasonText(c, reason)}]`, proposed: a.proposed ?? null });
  }
  const already = flow.state === "escalated";
  const next = await patchFlow(c.db, flow.id, {
    state: "escalated", resume_state: already ? flow.resume_state : flow.state, escalated_at: already ? flow.escalated_at : now(), escalation_reason: reason,
  });
  if (flow.conversation_id) {
    await c.db.from("agent_conversations").update({ handled_by: LEAD_GEN_ACTOR, handled_at: now() }).eq("id", flow.conversation_id).eq("workspace_id", c.ws);
    await sayInConversation(c.db, c.ws, flow.conversation_id, "system", pick(c, `Chuyển cho người phụ trách: ${reasonText(c, reason)}. Bot dừng trả lời cho đến khi người trả lại.`, `Handed to a person: ${reasonText(c, reason)}. The bot is silent until a person hands it back.`));
  }
  await logEvidence(c.db, c.ws, { lead_id: flow.lead_id, work_item_id: item.id, kind: "lead_gen.escalated", actor: LEAD_GEN_ACTOR, summary: pick(c, `Chuyển cho người: ${reasonText(c, reason)}`, `Handed to a person: ${reasonText(c, reason)}`), evidence: a.question.slice(0, 400) });
  if (!already && a.notify === true) await sendToFlow(c, next, lines.handover(loc(c))).catch(() => null);
  return next;
};

/** True while a person holds the conversation(s) of an escalated flow (the bot stays silent); false once they have handed it back. */
export const heldByPerson = async (db: Db, ws: string, flow: Pick<FlowRow, "state" | "conversation_id">, ...moreConversations: Array<string | null | undefined>): Promise<boolean> => {
  if (flow.state !== "escalated") return false;
  const ids = [flow.conversation_id, ...moreConversations].filter((x): x is string => !!x);
  if (!ids.length) return true;
  const { data } = await db.from("agent_conversations").select("handled_by").eq("workspace_id", ws).in("id", ids);
  return ((data ?? []) as Array<{ handled_by: string | null }>).some((r) => !!r.handled_by);
};

/** A person handed the conversation back: the bot resumes where the flow was before the escalation. */
export const resumeFlow = (db: Db, flow: FlowRow): Promise<FlowRow> =>
  patchFlow(db, flow.id, { state: flow.resume_state ?? "qualifying", resume_state: null, escalated_at: null, escalation_reason: null });

/**
 * Hand the lead to a person through the existing needs-human path (a reply_customer work item forced to "ask", the staff member tagged in
 * Office) and stop the bot (holdForPerson). Idempotent per flow and turn.
 */
export const escalateLead = async (
  c: EngineCtx, a: { readonly flow: FlowRow; readonly reason: EscalationReason; readonly text: string; readonly turn: string; readonly origin: Origin; /** a direct message: tell the person, once, that a colleague takes over */ readonly notify?: boolean },
): Promise<{ item: WorkItem; flow: FlowRow }> => {
  const { flow, reason } = a;
  const name = flow.name ?? pick(c, "Khách", "Customer");
  const question = a.text.trim() || pick(c, "(không có nội dung đọc được)", "(no readable text)");
  const item = await runWork(c, {
    action: "reply_customer", subject_type: flow.conversation_id ? "conversation" : "lead", subject_id: flow.conversation_id ?? flow.lead_id, lead_id: flow.lead_id, origin: a.origin,
    dedupeKey: `reply_customer:lead_gen:${flow.id}:${a.turn}`, preset: true, noChain: true, forceAsk: "unclear_outcome",
    seed: {
      summary: pick(c, `Tạo lead cần người: ${name} (${reasonText(c, reason)}). "${question.slice(0, 120)}"`, `Lead Gen needs a person: ${name} (${reasonText(c, reason)}). "${question.slice(0, 120)}"`),
      draft: "", fields: { question, ...(flow.conversation_id ? { conversation_id: flow.conversation_id } : {}), escalation: reason },
    },
  });
  return { item, flow: await holdForPerson(c, { flow, reason, item, question, notify: a.notify }) };
};

/* ------------------------------------------------------------------ the chain: what each finished step sends next */

type Chain = { from: "lead_gen"; parentId: string; chainId: string; origin: Origin; inboundEventId: string | null; queue: true };

const keep = (f: Record<string, unknown>, ...keys: Array<string>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (f[k] !== undefined && f[k] !== null && f[k] !== "") out[k] = f[k];
  return out;
};

/**
 * After a lead_gen step is done (by itself or approved by a person) queue the next one. The branches mirror the state machine in
 * lead-flow-rules.ts; the decision itself (`fields.step`) was made by score_lead, so this only translates it into a typed command.
 * handoff_to_sales is not handled here: its own `next` (classify_lead) is carried by the engine's generic FLOW_NEXT loop.
 */
export const leadGenContinue = async (c: EngineCtx, item: WorkItem): Promise<void> => {
  const leadId = item.lead_id;
  if (!leadId) return;
  const f = (item.proposal.fields ?? {}) as Record<string, unknown>;
  const chain: Chain = { from: "lead_gen", parentId: item.id, chainId: item.chain_id ?? item.id, origin: item.origin, inboundEventId: item.inbound_event_id, queue: true };
  const turn = str(f.turn) || item.id;
  const go = (command: string, reason: string, extra: Record<string, unknown>, dedupe: string, opts: { forceAsk?: WorkItem["reason"] } = {}) =>
    sendCommand(c, { ...chain, to: "lead_gen", command, reason, dedupeKey: dedupe, payload: { subject_type: "lead", subject_id: leadId, lead_id: leadId, ...extra }, ...opts })
      .catch((e: unknown) => { console.error(`lead_gen: ${command} not queued:`, e instanceof Error ? e.message : e); });
  const common = keep(f, "turn", "conversation_id", "connection_id", "source_kind", "comment_id", "post_id", "text");

  if (item.action === "capture_lead") {
    await go("score_lead", "lead_captured", { ...common }, `score_lead:${leadId}:${turn}`);
    return;
  }
  if (item.action === "score_lead") {
    const step = str(f.step);
    const base = { ...keep(f, "turn", "conversation_id", "reply", "comment_id", "post_id", "source_kind"), score: str(f.score) };
    if (f.handoff === "1" || step === "handoff") {
      await go("handoff_to_sales", "hot_lead", { contact: str(f.contact), need: str(f.need), score: "hot" }, `handoff_to_sales:${leadId}`);
    }
    if (step === "greet") await go("greet_prospect", "first_reply", base, `greet_prospect:${leadId}`);
    else if (step === "ask") await go("ask_qualifying", "qualify", { ...base, index: Number(f.index) || 0, question: str(f.question) }, `ask_qualifying:${leadId}:${Number(f.index) || 0}`);
    else if (step === "ask_contact") await go("ask_qualifying", "ask_contact", { ...base, index: Number(f.index) || 0, question_kind: "contact" }, `ask_qualifying:${leadId}:contact`);
    else if (step === "follow_up") await go("follow_up_lead", "warm_lead", base, `follow_up_lead:${leadId}:${turn}`);
    else if (step === "close") await go("close_lead", "cold_lead", base, `close_lead:${leadId}:${turn}`);
    else if (step === "comment") {
      const negative = f.negative === "1";
      const extra = { ...base, ...keep(f, "public_reply", "private_reply", "negative"), connection_id: str(f.connection_id) };
      if (!negative) {
        await go("reply_comment_public", "comment", extra, `reply_comment_public:comment:${str(f.comment_id)}`);
      } else {
        // A negative comment is proposed as ASK: the public reply waits for a person, who is tagged about it, and the bot goes quiet on this lead.
        const r = await sendCommand(c, {
          ...chain, queue: false, to: "lead_gen", command: "reply_comment_public", reason: "negative_comment", forceAsk: "over_authority", dedupeKey: `reply_comment_public:comment:${str(f.comment_id)}`,
          payload: { subject_type: "lead", subject_id: leadId, lead_id: leadId, ...extra },
        }).catch((e: unknown) => { console.error("lead_gen: negative comment not queued:", e instanceof Error ? e.message : e); return null; });
        const flow = await flowByLead(c.db, c.ws, leadId);
        if (r?.ok && flow) await holdForPerson(c, { flow, reason: "negative_comment", item: r.item, question: str(f.text) || flow.last_user_text || "", proposed: r.item.proposal.draft ?? null });
      }
    }
    return;
  }
  if (item.action === "reply_comment_public") {
    // A negative comment is a person's case now: no private message follows from the bot.
    if (f.negative === "1") return;
    await go("private_reply_comment", "comment", { ...keep(f, "turn", "conversation_id", "comment_id", "post_id", "private_reply", "connection_id") }, `private_reply_comment:comment:${str(f.comment_id)}`);
    return;
  }
  // greet_prospect, ask_qualifying, follow_up_lead, close_lead, private_reply_comment, message_with_human_agent_tag, send_lead_offer, quote_custom_price:
  // the conversation now waits for the person's next message (a new turn starts the chain again from score_lead).
};

