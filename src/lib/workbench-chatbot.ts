"use server";

import { revalidatePath } from "next/cache";
import { translator } from "@/i18n/core";
import { system } from "@/i18n/dict/system";
import { workbenchChatbot } from "@/i18n/dict/workbenchChatbot";
import { logEvidence } from "./core";
import { drainAfter, engineCtx } from "./flow-ctx";
import { decideWorkItem, takeOverConversation } from "./flow-actions";
import type { WorkItem } from "./flow-types";
import { deliverToChannel } from "./telegram";
import type { AgentConversation, Outcome } from "./types";

/* Chatbot workbench: queries and actions for the customer-conversation inbox. Everything runs as the signed-in member through RLS. */

export type WbChannel = "telegram" | "zalo" | "website";
export type WbDelivery = "sent" | "failed" | null;

export type WbMessage = {
  readonly id: string;
  readonly role: "user" | "agent" | "system";
  /** For role "agent": a person wrote it ("human") or the AI did ("ai"). */
  readonly authorKind: "ai" | "human";
  readonly authorName: string | null;
  readonly body: string;
  readonly createdAt: string;
  readonly delivery: WbDelivery;
  /** Why a push failed (a stable code, e.g. zalo_window_expired). */
  readonly deliveryError: string | null;
};

export type WbConversation = {
  readonly id: string;
  readonly channel: WbChannel;
  readonly name: string;
  readonly leadId: string | null;
  readonly lastText: string;
  readonly lastRole: "user" | "agent" | "system" | null;
  readonly lastAt: string;
  readonly messageCount: number;
  readonly handledBy: string | null;
  readonly waiting: boolean;
  /** The customer wrote last and nobody (AI or person) has answered yet. */
  readonly unanswered: boolean;
};

export type WbMetrics = {
  readonly today: number;
  readonly waiting: number;
  /** Average minutes from a customer's first message to the first reply, last 30 days; null when nothing to compute from. */
  readonly avgFirstResponseMin: number | null;
  readonly sample: number;
};

export type WbLead = { readonly id: string; readonly name: string; readonly company: string; readonly stage: string; readonly need: string; readonly phone: string | null; readonly email: string | null };

export type WbEscalation = {
  readonly workItemId: string;
  readonly question: string;
  readonly draft: string;
  readonly staffName: string | null;
  readonly since: string;
};

export type WbThread = {
  readonly conversation: WbConversation;
  readonly messages: ReadonlyArray<WbMessage>;
  readonly lead: WbLead | null;
  readonly escalation: WbEscalation | null;
  readonly externalId: string | null;
  readonly handledAt: string | null;
};

export type WbOverview = {
  readonly workspaceId: string;
  readonly nowIso: string;
  readonly conversations: ReadonlyArray<WbConversation>;
  readonly metrics: WbMetrics;
};

type Ctx = Awaited<ReturnType<typeof engineCtx>>;
type ConvRow = AgentConversation;
type MsgRow = {
  id: string; conversation_id: string; role: "user" | "agent" | "system"; body: string; created_at: string;
  author_kind?: "ai" | "human" | null; author_name?: string | null; delivery_status?: "sent" | "failed" | null; delivery_error?: string | null;
};

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;
const vnDayStart = (now: number): number => Math.floor((now + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

const channelOfRow = (c: Pick<ConvRow, "channel">): WbChannel => (c.channel === "telegram" ? "telegram" : c.channel === "zalo" ? "zalo" : "website");

const toMessage = (m: MsgRow): WbMessage => ({
  id: m.id, role: m.role, authorKind: m.author_kind === "human" ? "human" : "ai", authorName: m.author_name ?? null, body: m.body, createdAt: m.created_at,
  delivery: m.delivery_status ?? null, deliveryError: m.delivery_error ?? null,
});

/** Conversation id a waiting reply_customer item belongs to. */
const waitingConversationId = (w: Pick<WorkItem, "subject_id" | "proposal">): string | null => {
  const f = w.proposal?.fields?.conversation_id;
  return typeof f === "string" ? f : w.subject_id;
};

const chatbotAgentIds = async (c: Ctx): Promise<Array<string>> =>
  (((await c.db.from("agents").select("id").eq("workspace_id", c.ws).eq("module", "chatbot")).data ?? []) as Array<{ id: string }>).map((a) => a.id);

/** Customer conversations of the workspace's Chatbot, newest activity first, with the header metrics. */
export async function loadChatbotOverview(): Promise<WbOverview> {
  const c = await engineCtx();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const agentIds = await chatbotAgentIds(c);
  const empty: WbOverview = { workspaceId: c.ws, nowIso, conversations: [], metrics: { today: 0, waiting: 0, avgFirstResponseMin: null, sample: 0 } };
  if (!agentIds.length) return empty;

  const convRows = ((await c.db.from("agent_conversations").select("*").eq("workspace_id", c.ws).eq("kind", "customer").in("agent_id", agentIds)
    .order("created_at", { ascending: false }).limit(200)).data ?? []) as Array<ConvRow>;
  if (!convRows.length) return empty;
  const ids = convRows.map((r) => r.id);
  const leadIds = convRows.map((r) => r.lead_id).filter((x): x is string => !!x);

  const since = new Date(now - 30 * DAY_MS).toISOString();
  const [msgRes, waitRes, leadRes] = await Promise.all([
    c.db.from("agent_messages").select("id, conversation_id, role, body, created_at").eq("workspace_id", c.ws).in("conversation_id", ids)
      .gte("created_at", since).order("created_at", { ascending: true }).limit(6000),
    c.db.from("work_items").select("id, subject_id, proposal").eq("workspace_id", c.ws).eq("action", "reply_customer").eq("status", "waiting_decision").limit(200),
    leadIds.length ? c.db.from("leads").select("id, contact_name").eq("workspace_id", c.ws).in("id", leadIds) : Promise.resolve({ data: [] }),
  ]);
  const msgs = (msgRes.data ?? []) as Array<MsgRow>;
  const waiting = new Set(((waitRes.data ?? []) as Array<Pick<WorkItem, "subject_id" | "proposal">>).map(waitingConversationId).filter((x): x is string => !!x));
  const leadName = new Map(((leadRes.data ?? []) as Array<{ id: string; contact_name: string }>).map((l) => [l.id, l.contact_name]));

  const byConv = new Map<string, Array<MsgRow>>();
  for (const m of msgs) {
    const list = byConv.get(m.conversation_id);
    if (list) list.push(m);
    else byConv.set(m.conversation_id, [m]);
  }

  const dayStart = vnDayStart(now);
  const deltas: Array<number> = [];
  const conversations = convRows.map((r): WbConversation => {
    const list = byConv.get(r.id) ?? [];
    const talk = list.filter((m) => m.role !== "system");
    const last = list.at(-1) ?? null;
    const lastTalk = talk.at(-1) ?? null;
    const firstUser = talk.find((m) => m.role === "user");
    const firstReply = firstUser ? talk.find((m) => m.role === "agent" && m.created_at > firstUser.created_at) : undefined;
    if (firstUser && firstReply) deltas.push((Date.parse(firstReply.created_at) - Date.parse(firstUser.created_at)) / 60_000);
    const shown = lastTalk ?? last;
    return {
      id: r.id, channel: channelOfRow(r), name: r.visitor_name?.trim() || (r.lead_id ? leadName.get(r.lead_id) : undefined) || "", leadId: r.lead_id,
      lastText: clip(shown?.body ?? "", 140), lastRole: shown?.role ?? null, lastAt: last?.created_at ?? r.created_at,
      messageCount: talk.length, handledBy: r.handled_by ?? null, waiting: waiting.has(r.id),
      unanswered: lastTalk?.role === "user" && (waiting.has(r.id) || !!r.handled_by),
    };
  }).sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  const avg = deltas.length ? deltas.reduce((s, x) => s + x, 0) / deltas.length : null;
  return {
    workspaceId: c.ws, nowIso, conversations,
    metrics: {
      today: convRows.filter((r) => Date.parse(r.created_at) >= dayStart).length,
      waiting: conversations.filter((x) => x.waiting).length,
      avgFirstResponseMin: avg === null ? null : Math.round(avg * 100) / 100,
      sample: deltas.length,
    },
  };
}

type LeadRow = { id: string; contact_name: string; company: string; stage: string; need: string; phone: string | null; email: string | null };

/** One conversation with its messages, lead and the open escalation (if any). */
export async function loadChatbotThread(conversationId: string): Promise<WbThread | null> {
  const c = await engineCtx();
  const conv = ((await c.db.from("agent_conversations").select("*").eq("id", conversationId).eq("workspace_id", c.ws).maybeSingle()).data ?? null) as ConvRow | null;
  if (!conv) return null;
  const [msgRes, waitRes, leadRes] = await Promise.all([
    c.db.from("agent_messages").select("*").eq("conversation_id", conv.id).order("created_at", { ascending: true }).limit(500),
    c.db.from("work_items").select("*").eq("workspace_id", c.ws).eq("action", "reply_customer").eq("status", "waiting_decision").order("created_at"),
    conv.lead_id ? c.db.from("leads").select("id, contact_name, company, stage, need, phone, email").eq("id", conv.lead_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const rows = (msgRes.data ?? []) as Array<MsgRow>;
  const item = ((waitRes.data ?? []) as Array<WorkItem>).find((w) => waitingConversationId(w) === conv.id) ?? null;
  let staffName: string | null = null;
  if (item?.assigned_staff_id) {
    staffName = ((await c.db.from("staff").select("name").eq("id", item.assigned_staff_id).maybeSingle()).data as { name: string } | null)?.name ?? null;
  }
  const l = leadRes.data as LeadRow | null;
  const talk = rows.filter((m) => m.role !== "system");
  const lastTalk = talk.at(-1) ?? null;
  const last = rows.at(-1) ?? null;
  const shown = lastTalk ?? last;
  const f = item?.proposal?.fields ?? {};
  return {
    conversation: {
      id: conv.id, channel: channelOfRow(conv), name: conv.visitor_name?.trim() || l?.contact_name || "", leadId: conv.lead_id,
      lastText: clip(shown?.body ?? "", 140), lastRole: shown?.role ?? null, lastAt: last?.created_at ?? conv.created_at,
      messageCount: talk.length, handledBy: conv.handled_by ?? null, waiting: !!item, unanswered: lastTalk?.role === "user" && (!!item || !!conv.handled_by),
    },
    messages: rows.map(toMessage),
    lead: l ? { id: l.id, name: l.contact_name, company: l.company, stage: l.stage, need: l.need, phone: l.phone, email: l.email } : null,
    escalation: item ? { workItemId: item.id, question: String(f.question ?? item.proposal?.summary ?? ""), draft: item.proposal?.draft ?? "", staffName, since: item.created_at } : null,
    externalId: conv.external_id ?? null,
    handledAt: conv.handled_at ?? null,
  };
}

/** Take the conversation over (the AI goes quiet). */
export async function takeOver(conversationId: string): Promise<Outcome<{ handled_by: string | null }>> {
  const out = await takeOverConversation(conversationId, true);
  revalidatePath("/", "layout");
  return out;
}

/** Hand the conversation back to the AI. */
export async function handBack(conversationId: string): Promise<Outcome<{ handled_by: string | null }>> {
  const out = await takeOverConversation(conversationId, false);
  revalidatePath("/", "layout");
  return out;
}

/** The signed-in member's own reply while they hold the conversation; Telegram customers get it in their chat. */
export async function replyAsMember(conversationId: string, body: string): Promise<Outcome<{ delivery: "sent" | "failed" }>> {
  try {
    const c = await engineCtx();
    const text = body.trim();
    const w = translator(workbenchChatbot, c.locale);
    if (!text) throw new Error(w("emptyReply"));
    const conv = ((await c.db.from("agent_conversations").select("*").eq("id", conversationId).eq("workspace_id", c.ws).maybeSingle()).data ?? null) as ConvRow | null;
    if (!conv) throw new Error("Not found");
    if (!conv.handled_by) throw new Error(w("takeOverFirst"));
    const name = c.session.member.displayName;
    const ins = await c.db.from("agent_messages").insert({
      workspace_id: c.ws, conversation_id: conv.id, role: "agent", body: text, author_kind: "human", author_name: name,
    }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    const sent = await deliverToChannel(c.db, conv.id, text);
    const status: "sent" | "failed" = (conv.channel === "telegram" || conv.channel === "zalo") && !sent ? "failed" : "sent";
    await c.db.from("agent_messages").update(status === "sent" ? { delivery_status: status, delivery_error: null } : { delivery_status: status }).eq("id", (ins.data as { id: string }).id).eq("workspace_id", c.ws);
    await logEvidence(c.db, c.ws, { lead_id: conv.lead_id, kind: "conversation.human_reply", actor: name, summary: translator(system, c.locale)("takenOverNoReply"), evidence: text });
    revalidatePath("/", "layout");
    return { ok: true, data: { delivery: status } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Answer a waiting escalation as the signed-in member through the normal decision path (permissions, decision log,
 * evidence): `text` becomes the approved draft, is posted and delivered. `null` declines to answer (reject).
 */
export async function answerEscalation(workItemId: string, conversationId: string, text: string | null): Promise<Outcome<{ delivered: boolean }>> {
  try {
    const c = await engineCtx();
    const answer = text?.trim() ?? "";
    const w = translator(workbenchChatbot, c.locale);
    if (text !== null && !answer) throw new Error(w("emptyReply"));
    const res = await decideWorkItem(workItemId, text === null ? "rejected" : "approved", text === null ? undefined : { draft: answer });
    if (!res.ok) return { ok: false, error: res.error };
    let delivered = false;
    if (text !== null) {
      const conv = ((await c.db.from("agent_conversations").select("channel").eq("id", conversationId).eq("workspace_id", c.ws).maybeSingle()).data ?? null) as { channel: string | null } | null;
      const posted = res.data.result?.summary === translator(system, c.locale)("replyPostedTelegram");
      delivered = (conv?.channel === "telegram" || conv?.channel === "zalo") ? posted : true;
      // The performer stored the answer as an unlabelled line: attribute it to this member and record honest delivery.
      const { data } = await c.db.from("agent_messages").select("id").eq("conversation_id", conversationId).eq("workspace_id", c.ws).eq("role", "agent")
        .eq("body", answer).is("author_kind", null).order("created_at", { ascending: false }).limit(1);
      const id = (data as Array<{ id: string }> | null)?.[0]?.id;
      if (id) await c.db.from("agent_messages").update({ author_kind: "human", author_name: c.session.member.displayName, delivery_status: delivered ? "sent" : "failed" }).eq("id", id);
    }
    drainAfter(c);
    revalidatePath("/", "layout");
    return { ok: true, data: { delivered } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
