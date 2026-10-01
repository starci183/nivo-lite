import "server-only";
import { intlLocale, translator, type Locale } from "@/i18n/core";
import { system } from "@/i18n/dict/system";
import { governance } from "@/i18n/dict/governance";
import * as ai from "./deepseek";
import { deliverToChannel } from "./telegram";
import { ACTION_DEPARTMENT, FLOW_NEXT, evaluateGate, isOverLimit } from "./policy";
import { contactParts, logDecision, logEvidence, matchLead, normaliseContact, type Db } from "./core";
import { transferDetails } from "./knowledge";
import { bankConnectionOf, mentionsCode } from "./bank";
import type {
  Authority, AuthorityRule, Department, EvidenceState, FlowAction, GateVerdict, InboundEvent, Invoice, Order, Origin, Proposal,
  ReasonCode, Transaction, WorkEdits, WorkItem,
} from "./flow-types";
import type { Agent, AgentConversation, Lead, Responsibility } from "./types";

/**
 * The NIVO engine: every AI step is a work item that passes the policy gate, then either completes by itself
 * (decision logged as policy) or waits for a human decision and resumes the same work afterwards.
 * No Next.js request APIs are used here, so it can run after the response (`after()`).
 */
export type EngineCtx = { db: Db; ws: string; actor: string; locale: Locale };
export type Decider = { name: string; kind: "owner" | "staff" };

export type WorkSpec = {
  action: FlowAction;
  subject_type: WorkItem["subject_type"];
  subject_id?: string | null;
  lead_id?: string | null;
  inbound_event_id?: string | null;
  parent_id?: string | null;
  dedupeKey: string;
  origin: Origin;
  /** initial proposal data (e.g. structured fields from the inbound channel) */
  seed?: Partial<Proposal>;
  /** insert only; `runQueued` performs it later (chain steps) */
  queue?: boolean;
  /** use `seed` as the proposal as-is (no prepare step, no LLM call) */
  preset?: boolean;
  /** do not continue the chain after this step */
  noChain?: boolean;
  /** always ask a human, with this reason (e.g. the chatbot flagged a commitment) */
  forceAsk?: ReasonCode;
};

const NIVO_BY = { name: "NIVO", kind: "policy" as const };
const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ labels */

const tr = (c: EngineCtx) => translator(system, c.locale);
const gl = (c: EngineCtx, key: string) => (translator(governance, c.locale) as (k: string) => string)(key);
export const formatVnd = (n: number | null | undefined, locale: Locale) =>
  n === null || n === undefined ? "" : new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
const vnd = (c: EngineCtx, n: number | null | undefined) => (n === null || n === undefined ? tr(c)("orderNoAmount") : formatVnd(n, c.locale));
const deptLabel = (c: EngineCtx, d: Department) => gl(c, `dept_${d}`);
const stageLabel = (c: EngineCtx, s: string) => (tr(c) as (k: string) => string)(`stage_${s}`);
export const fieldLabels = (c: EngineCtx, fields: Array<string>) => fields.map((f) => gl(c, `field_${f}`)).join(", ");

/* ------------------------------------------------------------------ loaders (memoised per ctx) */

const memo = new WeakMap<EngineCtx, Map<string, Promise<unknown>>>();
const once = <T>(c: EngineCtx, key: string, fn: () => Promise<T>): Promise<T> => {
  let m = memo.get(c);
  if (!m) memo.set(c, (m = new Map()));
  if (!m.has(key)) m.set(key, fn());
  return m.get(key) as Promise<T>;
};

export const loadAuthority = (c: EngineCtx) =>
  once(c, "authority", async () => ((await c.db.from("authority").select("*").eq("workspace_id", c.ws).maybeSingle()).data ?? null) as Authority | null);

const loadRule = async (c: EngineCtx, action: FlowAction) =>
  ((await c.db.from("authority_rules").select("*").eq("workspace_id", c.ws).eq("action", action).maybeSingle()).data ?? null) as AuthorityRule | null;

const agentFor = (c: EngineCtx, d: Department) =>
  once(c, `agent:${d}`, async () =>
    (((await c.db.from("agents").select("*").eq("workspace_id", c.ws).eq("module", d).eq("status", "active").order("created_at").limit(1)).data ?? [])[0] ?? null) as Agent | null);

const brief = async (c: EngineCtx) => ai.authorityBrief(await loadAuthority(c));

const getLead = async (c: EngineCtx, id: string | null) => {
  if (!id) return null;
  return ((await c.db.from("leads").select("*").eq("id", id).maybeSingle()).data ?? null) as Lead | null;
};
const mustLead = async (c: EngineCtx, id: string | null) => {
  const l = await getLead(c, id);
  if (!l) throw new Error("Lead not found");
  return l;
};
const getInbound = async (c: EngineCtx, id: string | null) =>
  id ? (((await c.db.from("inbound_events").select("*").eq("id", id).maybeSingle()).data ?? null) as InboundEvent | null) : null;

const leadInput = (l: Lead): ai.LeadInput => ({ contact_name: l.contact_name, company: l.company, channel: l.channel, need: l.need });
const agentInput = (a: Agent): ai.AgentInput => ({ name: a.name, handle: a.handle, role: a.role, instructions: a.instructions, knowledge: a.knowledge, approval_rule: a.approval_rule });

/* ------------------------------------------------------------------ Office + inbound status */

/** One short line in the Office thread from NIVO (agent_id null, author "NIVO": Office renders it as NIVO Core), linked to the work item. */
const postOffice = async (c: EngineCtx, m: { body: string; lead_id: string | null; work_item_id: string | null; dept?: Department }) => {
  await c.db.from("messages").insert({
    workspace_id: c.ws, author_kind: "system", author_name: "NIVO", agent_id: null, body: m.body, lead_id: m.lead_id, work_item_id: m.work_item_id,
  });
};

const setInbound = async (c: EngineCtx, id: string | null, patch: Partial<Pick<InboundEvent, "status" | "lead_id">>) => {
  if (id) await c.db.from("inbound_events").update(patch).eq("id", id);
};

/* ------------------------------------------------------------------ delivery (honest labels) */

/** The customer's latest real conversation (website chat or Telegram), optionally only on one channel. */
const customerConversation = async (c: EngineCtx, leadId: string, channel?: string) => {
  let q = c.db.from("agent_conversations").select("*").eq("lead_id", leadId).eq("kind", "customer");
  if (channel) q = q.eq("channel", channel);
  return (((await q.order("created_at", { ascending: false }).limit(1)).data ?? [])[0] ?? null) as AgentConversation | null;
};

/**
 * Deliver a message to the customer: stored in their conversation and pushed to Telegram when that is where they are
 * (real delivery), shown in the website chat page, otherwise recorded and labelled simulated.
 */
const deliver = async (c: EngineCtx, lead: Lead, text: string): Promise<{ summary: string; real: boolean }> => {
  const conv = await customerConversation(c, lead.id);
  if (conv) {
    await c.db.from("agent_messages").insert({ workspace_id: c.ws, conversation_id: conv.id, role: "agent", body: text });
    if (conv.channel === "telegram") {
      const sent = await deliverToChannel(c.db, conv.id, text);
      return { summary: tr(c)(sent ? "deliveredTelegram" : "telegramFailed", { name: lead.contact_name }), real: sent };
    }
    return { summary: tr(c)("deliveredWebsite", { name: lead.contact_name }), real: true };
  }
  return { summary: tr(c)("simulatedDelivery", { channel: lead.channel }), real: false };
};

const ensureResponsibility = async (c: EngineCtx, lead: Lead): Promise<Responsibility> => {
  const open = (((await c.db.from("responsibilities").select("*").eq("lead_id", lead.id).neq("status", "done").order("created_at", { ascending: false }).limit(1)).data ?? [])[0] ?? null) as Responsibility | null;
  if (open) return open;
  const sales = await agentFor(c, "sales");
  const { data, error } = await c.db.from("responsibilities").insert({
    workspace_id: c.ws, lead_id: lead.id, title: tr(c)("respTitle", { name: lead.contact_name }),
    owner_kind: sales ? "agent" : "human", owner_agent_id: sales?.id ?? null, owner_name: sales?.name ?? c.actor,
    next_action: tr(c)("respNext"), due_at: new Date(Date.now() + 86_400_000).toISOString(),
  }).select().single();
  if (error) throw new Error(error.message);
  return data as Responsibility;
};

/* ------------------------------------------------------------------ performers */

type Prepared = { proposal: Proposal; patch?: Partial<Pick<WorkItem, "subject_type" | "subject_id" | "lead_id">> };
type Performed = { summary: string; evidence: EvidenceState; href?: string; lead_id?: string | null; detail?: string | null };
type Performer = {
  prepare: (c: EngineCtx, item: WorkItem) => Promise<Prepared>;
  perform: (c: EngineCtx, item: WorkItem, p: Proposal, by: { name: string }) => Promise<Performed>;
  onReject?: (c: EngineCtx, item: WorkItem, p: Proposal, by: { name: string }) => Promise<void>;
};

const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const leadHref = (id: string | null | undefined) => (id ? `/leads/${id}` : "/chat");

const genOrderNo = () => {
  const d = new Date();
  return `DH-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
};

const nextInvoiceNo = async (c: EngineCtx) => {
  const d = new Date();
  const prefix = `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-`;
  const { data } = await c.db.from("invoices").select("invoice_no").eq("workspace_id", c.ws).like("invoice_no", `${prefix}%`).order("invoice_no", { ascending: false }).limit(1);
  const last = data?.[0]?.invoice_no as string | undefined;
  const n = last ? Number(last.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(n + 1).padStart(4, "0")}`;
};

/** Find or create the customer for an inbound order/payment. */
const leadForInbound = async (c: EngineCtx, item: WorkItem, inb: InboundEvent | null, need: string): Promise<Lead> => {
  if (item.lead_id) return mustLead(c, item.lead_id);
  const { phone, email } = contactParts(inb?.sender_contact ?? null);
  const channelLabel = inb ? gl(c, `channel_${inb.channel}`) : "";
  const found = await matchLead(c.db, c.ws, { phone, email, name: inb?.sender_name, channel: channelLabel });
  if (found) return found;
  const { data, error } = await c.db.from("leads").insert({
    workspace_id: c.ws, contact_name: inb?.sender_name || tr(c)("notShared"), company: tr(c)("notShared"), channel: channelLabel || "—",
    need: need || "—", phone, email, origin: item.origin,
  }).select().single();
  if (error) throw new Error(error.message);
  const lead = data as Lead;
  await ensureResponsibility(c, lead);
  await logEvidence(c.db, c.ws, { lead_id: lead.id, work_item_id: item.id, kind: "lead.captured", actor: deptLabel(c, "chatbot"), summary: tr(c)("capturedFrom", { channel: lead.channel }), evidence: inb?.body || null });
  return lead;
};

const handoffLead: Performer = {
  prepare: async (c, item) => {
    const f = item.proposal.fields ?? {};
    return { proposal: { ...item.proposal, summary: tr(c)("handoffSummary", { name: str(f.contact_name), need: str(f.need) }), fields: f } };
  },
  perform: async (c, item, p) => {
    const f = p.fields;
    const { phone, email } = contactParts(normaliseContact(str(f.contact)));
    const channel = str(f.channel_label) || "—";
    let lead = await matchLead(c.db, c.ws, { phone, email, name: str(f.contact_name), channel });
    const matched = !!lead;
    if (!lead) {
      const { data, error } = await c.db.from("leads").insert({
        workspace_id: c.ws, contact_name: str(f.contact_name), company: str(f.company) || tr(c)("notShared"), channel, need: str(f.need),
        phone, email, origin: item.origin,
      }).select().single();
      if (error) throw new Error(error.message);
      lead = data as Lead;
      await logEvidence(c.db, c.ws, {
        lead_id: lead.id, work_item_id: item.id, kind: "lead.captured", actor: (await agentFor(c, "chatbot"))?.name ?? deptLabel(c, "chatbot"),
        summary: tr(c)("capturedFrom", { channel }), evidence: str(f.transcript) || null,
      });
    } else if ((phone && !lead.phone) || (email && !lead.email)) {
      await c.db.from("leads").update({ ...(phone && !lead.phone ? { phone } : {}), ...(email && !lead.email ? { email } : {}) }).eq("id", lead.id);
    }
    await setInbound(c, item.inbound_event_id, { lead_id: lead.id });
    if (str(f.conversation_id)) await c.db.from("agent_conversations").update({ lead_id: lead.id }).eq("id", str(f.conversation_id));
    await ensureResponsibility(c, lead);
    return {
      summary: matched ? tr(c)("leadMatched", { name: lead.contact_name }) : tr(c)("handoffDone", { name: lead.contact_name }),
      evidence: "captured", href: leadHref(lead.id), lead_id: lead.id,
    };
  },
};

const classifyLead: Performer = {
  prepare: async (c, item) => {
    const lead = await mustLead(c, item.lead_id);
    const events = ((await c.db.from("events").select("summary, evidence").eq("lead_id", lead.id).order("created_at").limit(12)).data ?? [])
      .map((e) => `${e.summary}${e.evidence ? `: ${String(e.evidence).slice(0, 400)}` : ""}`);
    const k = await ai.classifyLead(leadInput(lead), events, await brief(c), c.locale);
    return {
      proposal: {
        summary: tr(c)("classifySummary", { name: lead.contact_name, stage: stageLabel(c, k.stage), pct: Math.round(k.confidence * 100) }),
        confidence: k.confidence, outcome: k.confidence < 0.6 ? "unclear" : "clear",
        fields: { stage: k.stage, next_action: k.next_action, context: k.context, missing: k.missing.join(", ") || null },
      },
    };
  },
  perform: async (c, item, p) => {
    const lead = await mustLead(c, item.lead_id);
    const stages = ["new", "qualified", "proposal", "won", "lost"];
    const stage = stages.includes(str(p.fields.stage)) ? str(p.fields.stage) : lead.stage;
    const patch: Record<string, unknown> = {};
    // The AI moves open leads forward; it never re-opens or closes a finished deal by itself.
    if (!["won", "lost"].includes(lead.stage) && stage !== "won") patch.stage = stage;
    if (!lead.context_summary && str(p.fields.context)) patch.context_summary = str(p.fields.context);
    if (Object.keys(patch).length) await c.db.from("leads").update(patch).eq("id", lead.id);
    const next = str(p.fields.next_action);
    if (next) {
      const resp = await ensureResponsibility(c, lead);
      await c.db.from("responsibilities").update({ next_action: next }).eq("id", resp.id);
    }
    if (patch.context_summary) {
      await logEvidence(c.db, c.ws, { lead_id: lead.id, work_item_id: item.id, kind: "context.summarised", actor: deptLabel(c, "sales"), summary: tr(c)("contextCreated"), evidence: str(patch.context_summary) });
    }
    return {
      summary: tr(c)("classified", { name: lead.contact_name, stage: stageLabel(c, (patch.stage as string) ?? lead.stage), next: next || "—" }),
      evidence: "captured", href: leadHref(lead.id), lead_id: lead.id,
    };
  },
};

const followUpLike = (kind: "follow_up" | "care" | "quote"): Performer => ({
  prepare: async (c, item) => {
    const lead = await mustLead(c, item.lead_id);
    const conv = ((await c.db.from("agent_conversations").select("id").eq("lead_id", lead.id).eq("kind", "customer").limit(1)).data ?? [])[0];
    const contact = lead.phone || lead.email || (conv ? "website" : null);
    const base = item.proposal.fields ?? {};
    if (kind === "care") {
      const tx = item.subject_type === "transaction" && item.subject_id
        ? (((await c.db.from("transactions").select("*").eq("id", item.subject_id).maybeSingle()).data ?? null) as Transaction | null) : null;
      const invId = str(base.invoice_id) || tx?.invoice_id || (item.subject_type === "invoice" ? item.subject_id : null);
      const inv = invId ? (((await c.db.from("invoices").select("*").eq("id", invId).maybeSingle()).data ?? null) as Invoice | null) : null;
      const order = inv?.order_id ? (((await c.db.from("orders").select("items").eq("id", inv.order_id).maybeSingle()).data ?? null) as Pick<Order, "items"> | null) : null;
      const note = [order?.items, inv?.invoice_no, formatVnd(inv?.amount_vnd ?? tx?.amount_vnd ?? null, c.locale)].filter(Boolean).join(" · ");
      const draft = await ai.draftCare(leadInput(lead), note, await brief(c), c.locale);
      return { proposal: { summary: tr(c)("careSummary", { name: lead.contact_name }), draft, fields: { ...base, customer: lead.contact_name, contact } } };
    }
    if (kind === "quote") {
      const amount = typeof item.proposal.amount_vnd === "number" ? item.proposal.amount_vnd : null;
      return { proposal: { ...item.proposal, summary: tr(c)("quoteSummary", { name: lead.contact_name, amount: vnd(c, amount) }), amount_vnd: amount, fields: { ...base, customer: lead.contact_name, contact, amount_vnd: amount } } };
    }
    const respId = str(base.responsibility_id);
    const resp = respId
      ? ((await c.db.from("responsibilities").select("*").eq("id", respId).single()).data as Responsibility)
      : await ensureResponsibility(c, lead);
    const agent = resp.owner_agent_id ? (((await c.db.from("agents").select("*").eq("id", resp.owner_agent_id).maybeSingle()).data ?? null) as Agent | null) : await agentFor(c, "sales");
    const draft = await ai.draftFollowUp(leadInput(lead), lead.context_summary ?? "", resp.next_action, agent ? agentInput(agent) : null, await brief(c));
    return { proposal: { summary: tr(c)("followSummary", { name: lead.contact_name }), draft, fields: { ...base, customer: lead.contact_name, contact, responsibility_id: resp.id } } };
  },
  perform: async (c, item, p, by) => {
    const lead = await mustLead(c, item.lead_id);
    const text = p.draft ?? p.summary;
    const d = await deliver(c, lead, text);
    if (kind === "follow_up") {
      const respId = str(p.fields.responsibility_id) || (await ensureResponsibility(c, lead)).id;
      const decided = { status: "approved", decided_by: by.name, decided_at: now(), draft: text };
      if (item.execution_id) await c.db.from("executions").update(decided).eq("id", item.execution_id);
      else {
        const sales = await agentFor(c, "sales");
        const ex = await c.db.from("executions").insert({ workspace_id: c.ws, responsibility_id: respId, agent_id: sales?.id ?? null, work_item_id: item.id, ...decided }).select("id").single();
        if (ex.data) await c.db.from("work_items").update({ execution_id: ex.data.id }).eq("id", item.id);
      }
      await c.db.from("responsibilities").update({ status: "done" }).eq("id", respId);
      await logEvidence(c.db, c.ws, { lead_id: lead.id, work_item_id: item.id, kind: "execution.approved", actor: by.name, summary: d.summary, evidence: text });
    } else {
      await logEvidence(c.db, c.ws, { lead_id: lead.id, work_item_id: item.id, kind: kind === "care" ? "care.sent" : "quote.sent", actor: by.name, summary: d.summary, evidence: text });
    }
    return { summary: d.summary, evidence: "captured", href: leadHref(lead.id), lead_id: lead.id, detail: text };
  },
  onReject: async (c, item, p) => {
    if (kind !== "follow_up") return;
    if (item.execution_id) await c.db.from("executions").update({ status: "rejected", decided_by: c.actor, decided_at: now() }).eq("id", item.execution_id).eq("status", "pending_approval");
    const respId = str(p.fields.responsibility_id);
    if (respId) await c.db.from("responsibilities").update({ status: "open" }).eq("id", respId);
  },
});

const confirmOrder: Performer = {
  prepare: async (c, item) => {
    const inb = await getInbound(c, item.inbound_event_id);
    const f = item.proposal.fields ?? {};
    let amount: number | null = typeof f.amount_vnd === "number" ? f.amount_vnd : typeof item.proposal.amount_vnd === "number" ? item.proposal.amount_vnd : inb?.amount_vnd ?? null;
    let items = str(f.items);
    if (amount === null && inb?.body?.trim()) {
      const ex = await ai.extractOrder(inb.body, c.locale); // one LLM call, only when the channel gave no amount
      amount = ex.amount_vnd;
      if (!items) items = ex.items;
    }
    if (!items) items = inb?.body?.trim() ?? "";
    const lead = await leadForInbound(c, item, inb, items);
    let order: Order | null = item.subject_type === "order" && item.subject_id
      ? (((await c.db.from("orders").select("*").eq("id", item.subject_id).maybeSingle()).data ?? null) as Order | null) : null;
    if (!order) {
      let orderNo = str(f.order_no) || inb?.external_ref?.trim() || genOrderNo();
      for (let i = 0; i < 3 && !order; i++) {
        const ins = await c.db.from("orders").insert({
          workspace_id: c.ws, lead_id: lead.id, inbound_event_id: item.inbound_event_id, order_no: orderNo, items, amount_vnd: amount, status: "draft", origin: item.origin,
        }).select().single();
        if (ins.error?.code === "23505") orderNo = `${orderNo}-${Math.floor(10 + Math.random() * 89)}`;
        else if (ins.error) throw new Error(ins.error.message);
        else order = ins.data as Order;
      }
      if (!order) throw new Error("Could not create the order");
    }
    await setInbound(c, item.inbound_event_id, { lead_id: lead.id });
    return {
      proposal: {
        summary: tr(c)("orderSummary", { no: order.order_no, name: lead.contact_name, items: items || "—", amount: vnd(c, amount) }),
        amount_vnd: amount, fields: { customer: lead.contact_name, items, amount_vnd: amount, order_no: order.order_no },
      },
      patch: { subject_type: "order", subject_id: order.id, lead_id: lead.id },
    };
  },
  perform: async (c, item, p, by) => {
    const amount = typeof p.amount_vnd === "number" ? p.amount_vnd : typeof p.fields.amount_vnd === "number" ? p.fields.amount_vnd : null;
    // Guarded transition draft → confirmed: a repeated perform never re-confirms (or rolls back) an order.
    const { data, error } = await c.db.from("orders").update({
      status: "confirmed", amount_vnd: amount, items: str(p.fields.items), confirmed_by: by.name, confirmed_at: now(),
    }).eq("id", item.subject_id).eq("status", "draft").select();
    if (error) throw new Error(error.message);
    const order = ((data ?? [])[0] ?? null) as Order | null;
    if (!order) {
      const cur = ((await c.db.from("orders").select("*").eq("id", item.subject_id).maybeSingle()).data ?? null) as Order | null;
      if (!cur || cur.status === "cancelled") throw new Error("Order not found or cancelled");
      return { summary: tr(c)("orderConfirmed", { no: cur.order_no, amount: vnd(c, cur.amount_vnd) }), evidence: "captured", href: leadHref(cur.lead_id), lead_id: cur.lead_id };
    }
    if (order.lead_id) await c.db.from("leads").update({ stage: "won" }).eq("id", order.lead_id).neq("stage", "lost");
    const summary = tr(c)("orderConfirmed", { no: order.order_no, amount: vnd(c, amount) });
    await logEvidence(c.db, c.ws, { lead_id: order.lead_id, work_item_id: item.id, kind: "order.confirmed", actor: by.name, summary, evidence: str(p.fields.items) || null });
    return { summary, evidence: "captured", href: leadHref(order.lead_id), lead_id: order.lead_id };
  },
  onReject: async (c, item) => {
    if (item.subject_type === "order" && item.subject_id) {
      const { data } = await c.db.from("orders").update({ status: "cancelled" }).eq("id", item.subject_id).select("order_no, lead_id").single();
      if (data) await logEvidence(c.db, c.ws, { lead_id: data.lead_id, work_item_id: item.id, kind: "order.cancelled", actor: c.actor, summary: tr(c)("orderCancelled", { no: data.order_no }) });
    }
  },
};

/**
 * After an internal payment record is created for a customer who talks to us on Telegram: send them the package, amount,
 * record code (to put as the transfer content) and the owner's bank details from the knowledge line
 * "Thông tin chuyển khoản: …" (or say the team will send them). Stored in the conversation too. Returns the evidence line.
 */
const sendPaymentInstructions = async (c: EngineCtx, item: WorkItem, inv: Invoice): Promise<string | null> => {
  if (!inv.lead_id) return null;
  const conv = await customerConversation(c, inv.lead_id, "telegram");
  if (!conv) return null;
  const lead = await getLead(c, inv.lead_id);
  const order = inv.order_id ? (((await c.db.from("orders").select("items").eq("id", inv.order_id).maybeSingle()).data ?? null) as Pick<Order, "items"> | null) : null;
  const convAgent = ((await c.db.from("agents").select("*").eq("id", conv.agent_id).maybeSingle()).data ?? null) as Agent | null;
  const details = transferDetails((convAgent ?? (await agentFor(c, "chatbot")))?.knowledge);
  const text = tr(c)("payInstructions", {
    items: order?.items || "—", amount: formatVnd(inv.amount_vnd, c.locale), no: inv.invoice_no,
    transfer: details ? tr(c)("payTransferLine", { details }) : tr(c)("payTransferLater"),
  });
  await c.db.from("agent_messages").insert({ workspace_id: c.ws, conversation_id: conv.id, role: "agent", body: text });
  const sent = await deliverToChannel(c.db, conv.id, text);
  const summary = tr(c)(sent ? "payInstructionsSent" : "payInstructionsFailed", { no: inv.invoice_no, name: lead?.contact_name ?? conv.visitor_name ?? "—" });
  await logEvidence(c.db, c.ws, {
    lead_id: inv.lead_id, work_item_id: item.id, kind: sent ? "invoice.instructions_sent" : "invoice.instructions_failed",
    actor: deptLabel(c, "accounting"), summary, evidence: text,
  });
  return summary;
};

const issueInvoice: Performer = {
  prepare: async (c, item): Promise<Prepared> => {
    const f = item.proposal.fields ?? {};
    if (item.subject_type === "order" && item.subject_id) {
      const order = (await c.db.from("orders").select("*").eq("id", item.subject_id).single()).data as Order;
      const lead = await getLead(c, order.lead_id);
      const name = lead?.contact_name ?? "";
      return {
        proposal: { summary: tr(c)("invoiceSummary", { name, amount: vnd(c, order.amount_vnd) }), amount_vnd: order.amount_vnd, fields: { customer: name || null, amount_vnd: order.amount_vnd, order_no: order.order_no } },
        patch: { lead_id: order.lead_id },
      };
    }
    const lead = await mustLead(c, item.lead_id);
    const amount = typeof item.proposal.amount_vnd === "number" ? item.proposal.amount_vnd : typeof f.amount_vnd === "number" ? f.amount_vnd : null;
    return { proposal: { summary: tr(c)("invoiceSummary", { name: lead.contact_name, amount: vnd(c, amount) }), amount_vnd: amount, fields: { ...f, customer: lead.contact_name, amount_vnd: amount } } };
  },
  perform: async (c, item, p, by) => {
    const orderId = item.subject_type === "order" ? item.subject_id : null;
    const amount = (typeof p.amount_vnd === "number" ? p.amount_vnd : Number(p.fields.amount_vnd)) || 0;
    if (orderId) {
      const existing = ((await c.db.from("invoices").select("*").eq("order_id", orderId).limit(1)).data ?? [])[0] as Invoice | undefined;
      if (existing) return { summary: tr(c)("invoiceExists", { no: existing.invoice_no }), evidence: "captured", href: leadHref(existing.lead_id), lead_id: existing.lead_id };
    }
    let inv: Invoice | null = null;
    for (let i = 0; i < 4 && !inv; i++) {
      const no = await nextInvoiceNo(c);
      const ins = await c.db.from("invoices").insert({
        workspace_id: c.ws, order_id: orderId, lead_id: item.lead_id, invoice_no: no, amount_vnd: amount,
        due_at: new Date(Date.now() + 15 * 86_400_000).toISOString(), status: "issued", origin: item.origin, issued_by: by.name, issued_at: now(),
      }).select().single();
      if (ins.error?.code === "23505") {
        const dup = orderId ? (((await c.db.from("invoices").select("*").eq("order_id", orderId).limit(1)).data ?? [])[0] as Invoice | undefined) : undefined;
        if (dup) return { summary: tr(c)("invoiceExists", { no: dup.invoice_no }), evidence: "captured", href: leadHref(dup.lead_id), lead_id: dup.lead_id };
        continue; // invoice number taken by a concurrent step: take the next one
      }
      if (ins.error) throw new Error(ins.error.message);
      inv = ins.data as Invoice;
    }
    if (!inv) throw new Error("Could not number the invoice");
    if (orderId) await c.db.from("orders").update({ status: "invoiced" }).eq("id", orderId);
    const summary = tr(c)("invoiceIssued", { no: inv.invoice_no, amount: vnd(c, inv.amount_vnd), label: gl(c, "internalInvoice") });
    await logEvidence(c.db, c.ws, { lead_id: inv.lead_id, work_item_id: item.id, kind: "invoice.issued", actor: by.name, summary });
    // A live customer on Telegram gets the payment instructions right away (the record stands even if delivery fails).
    const sent = item.origin === "live"
      ? await sendPaymentInstructions(c, item, inv).catch((e: unknown) => {
        console.error("payment instructions failed", e instanceof Error ? e.message : e);
        return null;
      })
      : null;
    return { summary, evidence: "captured", href: leadHref(inv.lead_id), lead_id: inv.lead_id, detail: sent };
  },
};

/** Dedupe key prefix of the "customer says they paid" check for one invoice. */
const claimKey = (invoiceId: string) => `reconcile_payment:invoice:${invoiceId}`;

/**
 * The invoice is paid: a customer's claim still waiting for the same invoice needs no decision any more. It is closed as
 * settled (nobody approved it), so the owner is not asked twice and no second care message is sent.
 */
const settleClaims = async (c: EngineCtx, item: WorkItem, inv: Invoice) => {
  const summary = tr(c)("claimSettled", { no: inv.invoice_no });
  const { data } = await c.db.from("work_items").update({
    status: "done", decided_path: "auto", reason: "routine", completed_at: now(), updated_at: now(), evidence_state: "verified",
    result: { summary, href: leadHref(inv.lead_id) },
  }).eq("workspace_id", c.ws).eq("action", "reconcile_payment").eq("status", "waiting_decision").neq("id", item.id).like("dedupe_key", `${claimKey(inv.id)}%`).select("id, inbound_event_id");
  for (const row of (data ?? []) as Array<{ id: string; inbound_event_id: string | null }>) {
    await setInbound(c, row.inbound_event_id, { status: "processed" });
    await logEvidence(c.db, c.ws, { lead_id: inv.lead_id, work_item_id: row.id, kind: "work.settled", actor: "NIVO", summary });
  }
};

type InvoiceRow = Invoice & { order: { order_no: string } | null; lead: { contact_name: string } | null };

const reconcilePayment: Performer = {
  prepare: async (c, item) => {
    const inb = await getInbound(c, item.inbound_event_id);
    let tx: Transaction | null = item.subject_type === "transaction" && item.subject_id
      ? (((await c.db.from("transactions").select("*").eq("id", item.subject_id).maybeSingle()).data ?? null) as Transaction | null) : null;
    if (!tx) {
      const amount0 = inb?.amount_vnd ?? (typeof item.proposal.amount_vnd === "number" ? item.proposal.amount_vnd : null);
      const ins = await c.db.from("transactions").insert({
        workspace_id: c.ws, inbound_event_id: item.inbound_event_id, channel: "bank", amount_vnd: amount0 ?? 0,
        reference: inb?.external_ref ?? null, payer: inb?.sender_name ?? null, status: "unmatched", origin: item.origin,
      }).select().single();
      if (ins.error) throw new Error(ins.error.message);
      tx = ins.data as Transaction;
    }
    const amount = inb?.amount_vnd ?? tx.amount_vnd ?? null;
    const issued = ((await c.db.from("invoices").select("*, order:orders(order_no), lead:leads(contact_name)").eq("workspace_id", c.ws).eq("status", "issued").order("created_at", { ascending: false }).limit(50)).data ?? []) as Array<InvoiceRow>;
    const content = `${tx.reference ?? ""} ${inb?.body ?? ""}`;
    const byRef = issued.filter((i) => mentionsCode(content, i.invoice_no) || mentionsCode(content, i.order?.order_no));
    const byAmount = issued.filter((i) => i.amount_vnd === amount);
    const pool = byRef.length ? byRef : byAmount.length ? byAmount : issued.slice(0, 5);
    // Only a reference that names exactly one invoice of the same amount is clear; an amount-only match needs a human look.
    const clear = byRef.length === 1 && byRef[0].amount_vnd === amount;
    const bank = bankConnectionOf(inb);
    const payer = tx.payer || tr(c)("reconcileUnknownPayer");
    const ref = tx.reference || tr(c)("reconcileNoRef");
    return {
      proposal: {
        summary: bank ? tr(c)("bankCredit", { bank: bank.name, amount: vnd(c, amount), ref, payer }) : tr(c)("reconcileSummary", { amount: vnd(c, amount), payer, ref }),
        amount_vnd: amount, outcome: clear ? "clear" : "unclear",
        candidates: (clear ? byRef : pool).map((i) => ({ id: i.id, label: tr(c)("candidateLabel", { no: i.invoice_no, name: i.lead?.contact_name ?? "—", amount: vnd(c, i.amount_vnd) }), amount_vnd: i.amount_vnd })),
        fields: {
          amount_vnd: amount, reference: tx.reference, payer: tx.payer,
          ...(bank ? { bank: bank.name } : {}), ...(clear ? { match: tr(c)("matchedByCodeAmount") } : {}),
        },
      },
      patch: { subject_type: "transaction", subject_id: tx.id, ...(clear && byRef[0].lead_id ? { lead_id: byRef[0].lead_id } : {}) },
    };
  },
  perform: async (c, item, p, by) => {
    const chosen = p.candidates?.[0];
    if (!chosen || p.candidates?.length !== 1) throw new Error(tr(c)("chooseCandidate"));
    const inv = (await c.db.from("invoices").update({ status: "paid", paid_at: now() }).eq("id", chosen.id).select().single()).data as Invoice | null;
    if (!inv) throw new Error("Invoice not found");
    // A customer's "đã chuyển khoản" claim has no bank transaction of its own (its subject is the invoice).
    if (item.subject_type === "transaction") await c.db.from("transactions").update({ status: "matched", invoice_id: inv.id }).eq("id", item.subject_id);
    if (inv.order_id) await c.db.from("orders").update({ status: "paid" }).eq("id", inv.order_id);
    await setInbound(c, item.inbound_event_id, { lead_id: inv.lead_id });
    const matched = tr(c)("paymentMatched", { amount: vnd(c, p.amount_vnd ?? null), no: inv.invoice_no });
    const summary = str(p.fields.bank) ? `${p.summary} · ${matched}` : matched;
    const how = str(p.fields.match);
    await logEvidence(c.db, c.ws, {
      lead_id: inv.lead_id, work_item_id: item.id, kind: "payment.matched", actor: by.name, summary,
      evidence: [how, str(p.fields.reference)].filter(Boolean).join(" · ") || null,
    });
    await settleClaims(c, item, inv);
    return { summary, evidence: "verified", href: leadHref(inv.lead_id), lead_id: inv.lead_id, detail: how || null };
  },
  onReject: async (c, item) => {
    if (item.subject_type === "transaction" && item.subject_id) await c.db.from("transactions").update({ status: "needs_review" }).eq("id", item.subject_id);
  },
};

const replyCustomer: Performer = {
  prepare: async (_c, item) => ({ proposal: item.proposal }),
  perform: async (c, item, p) => {
    const convId = str(p.fields.conversation_id);
    let pushed = false;
    if (convId && p.draft) {
      await c.db.from("agent_messages").insert({ workspace_id: c.ws, conversation_id: convId, role: "agent", body: p.draft });
      pushed = await deliverToChannel(c.db, convId, p.draft);
    }
    return { summary: tr(c)(pushed ? "replyPostedTelegram" : "replyPosted"), evidence: "captured", href: leadHref(item.lead_id), lead_id: item.lead_id, detail: p.draft ?? null };
  },
};

const PERFORMERS: Record<FlowAction, Performer> = {
  reply_customer: replyCustomer,
  handoff_lead: handoffLead,
  classify_lead: classifyLead,
  send_follow_up: followUpLike("follow_up"),
  send_quote: followUpLike("quote"),
  confirm_order: confirmOrder,
  send_care: followUpLike("care"),
  issue_invoice: issueInvoice,
  reconcile_payment: reconcilePayment,
};

/* ------------------------------------------------------------------ the gate loop */

const patchItem = async (c: EngineCtx, id: string, patch: Record<string, unknown>): Promise<WorkItem> => {
  const { data, error } = await c.db.from("work_items").update({ ...patch, updated_at: now() }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as WorkItem;
};

/** Take a queued item for processing (optimistic lock on updated_at) so two workers never perform it twice. */
const claim = async (c: EngineCtx, item: WorkItem): Promise<WorkItem | null> => {
  const { data } = await c.db.from("work_items").update({ updated_at: now() }).eq("id", item.id).eq("status", "queued").eq("updated_at", item.updated_at).select();
  return ((data ?? [])[0] ?? null) as WorkItem | null;
};

/*
 * Approval scope: a human decision only ever satisfies the gate of the work item it was given for (resumeWork on that
 * item). It never carries over to the next step of the chain: Sales approving a 45M order does not authorise
 * Accounting to invoice 45M when Accounting's own limit is 20M; that invoice gets its own waiting_decision item.
 */

const fail = async (c: EngineCtx, item: WorkItem, e: unknown): Promise<WorkItem> => {
  const msg = e instanceof Error ? e.message : String(e);
  const failed = await patchItem(c, item.id, { status: "failed", error: msg.slice(0, 500) }).catch(() => ({ ...item, status: "failed" as const, error: msg }));
  await logEvidence(c.db, c.ws, { lead_id: item.lead_id, work_item_id: item.id, kind: "work.failed", actor: "NIVO", summary: tr(c)("failedMsg", { dept: deptLabel(c, item.department), action: gl(c, `action_${item.action}`), error: msg }) }).catch(() => {});
  await postOffice(c, { body: tr(c)("failedMsg", { dept: deptLabel(c, item.department), action: gl(c, `action_${item.action}`), error: msg }), lead_id: item.lead_id, work_item_id: item.id }).catch(() => {});
  await setInbound(c, item.inbound_event_id, { status: "failed" }).catch(() => {});
  return failed;
};

/** "Tự động dưới 20.000.000 ₫ · đơn này 45.000.000 ₫" when the ask is because the amount reached the limit. */
const limitNote = (c: EngineCtx, rule: AuthorityRule | null, proposal: Proposal): string | null => {
  const amount = typeof proposal.amount_vnd === "number" ? proposal.amount_vnd : null;
  if (!rule || !isOverLimit(rule.limit_vnd, amount)) return null;
  return (translator(governance, c.locale) as (k: string, p?: Record<string, string>) => string)("limitReached", {
    limit: formatVnd(rule.limit_vnd, c.locale), amount: formatVnd(amount, c.locale),
  });
};

const askHuman = async (c: EngineCtx, item: WorkItem, proposal: Proposal, v: GateVerdict, rule: AuthorityRule | null = null): Promise<WorkItem> => {
  let execution_id = item.execution_id;
  // Follow-up drafts keep using the existing approval card (Office ApprovalBubble, lead page) when nothing is missing.
  if (item.action === "send_follow_up" && !v.missing.length && !execution_id && item.lead_id) {
    const respId = str(proposal.fields.responsibility_id) || (await ensureResponsibility(c, await mustLead(c, item.lead_id))).id;
    const sales = await agentFor(c, "sales");
    const ex = await c.db.from("executions").insert({ workspace_id: c.ws, responsibility_id: respId, agent_id: sales?.id ?? null, draft: proposal.draft ?? "", work_item_id: item.id }).select("id").single();
    if (ex.error) throw new Error(ex.error.message);
    execution_id = ex.data.id as string;
    await c.db.from("responsibilities").update({ status: "waiting_approval" }).eq("id", respId);
  }
  const waiting = await patchItem(c, item.id, {
    status: "waiting_decision", reason: v.reason, reasons: v.reasons, missing_fields: v.missing, proposal, execution_id, decided_path: null, error: null,
  });
  const reasonLabel = gl(c, `reason_${v.reason}`);
  const overLimit = v.reasons.includes("over_authority") ? limitNote(c, rule, proposal) : null;
  const evidence = [v.missing.length ? fieldLabels(c, v.missing) : null, overLimit].filter(Boolean).join(" · ") || null;
  await logEvidence(c.db, c.ws, { lead_id: waiting.lead_id, work_item_id: waiting.id, kind: "work.asked", actor: deptLabel(c, waiting.department), summary: `${reasonLabel}: ${proposal.summary}`, evidence });
  await postOffice(c, { dept: waiting.department, body: tr(c)("askMsg", { dept: deptLabel(c, waiting.department), reason: reasonLabel, summary: proposal.summary }), lead_id: waiting.lead_id, work_item_id: waiting.id });
  await setInbound(c, waiting.inbound_event_id, { status: "needs_decision", ...(waiting.lead_id ? { lead_id: waiting.lead_id } : {}) });
  return waiting;
};

type Finish = { path: "auto" | "human"; by: { name: string; kind: "policy" | "owner" | "staff" }; outcome: "auto_done" | "approved" | "edited"; note?: string | null; before?: Proposal };

const finish = async (c: EngineCtx, item: WorkItem, proposal: Proposal, f: Finish, noChain = false): Promise<WorkItem> => {
  const res = await PERFORMERS[item.action].perform(c, item, proposal, f.by);
  const done = await patchItem(c, item.id, {
    status: "done", decided_path: f.path, proposal, result: { summary: res.summary, ...(res.href ? { href: res.href } : {}) },
    evidence_state: res.evidence, completed_at: now(), error: null, ...(res.lead_id !== undefined && res.lead_id !== null ? { lead_id: res.lead_id } : {}),
    ...(f.path === "auto" ? { reason: "routine", reasons: ["routine"], missing_fields: [] } : { missing_fields: [] }),
  });
  const dept = deptLabel(c, done.department);
  if (f.path === "auto") {
    await logDecision(c.db, c.ws, { work_item_id: done.id, lead_id: done.lead_id, department: done.department, action: done.action, decided_by: "NIVO", decider_kind: "policy", outcome: "auto_done", reason: "routine", note: res.summary });
    await logEvidence(c.db, c.ws, { lead_id: done.lead_id, work_item_id: done.id, kind: "work.auto_done", actor: dept, summary: res.summary, evidence: res.detail ?? null });
    await postOffice(c, { body: tr(c)("autoMsg", { dept, summary: res.summary }), lead_id: done.lead_id, work_item_id: done.id });
  } else {
    await logDecision(c.db, c.ws, {
      work_item_id: done.id, lead_id: done.lead_id, department: done.department, action: done.action, decided_by: f.by.name,
      decider_kind: f.by.kind, outcome: f.outcome, reason: item.reason, note: f.note ?? res.summary, before: f.before ?? null, after: proposal,
    });
    await logEvidence(c.db, c.ws, { lead_id: done.lead_id, work_item_id: done.id, kind: "work.resumed", actor: f.by.name, summary: res.summary, evidence: res.detail ?? null });
    await postOffice(c, { body: tr(c)("resumedMsg", { user: f.by.name, summary: res.summary }), lead_id: done.lead_id, work_item_id: done.id });
  }
  await setInbound(c, done.inbound_event_id, { status: "processed", ...(done.lead_id ? { lead_id: done.lead_id } : {}) });
  if (!noChain) await continueChain(c, done);
  return done;
};

type ProcessOpts = { preset?: boolean; noChain?: boolean; forceAsk?: ReasonCode };

const processItem = async (c: EngineCtx, claimed: WorkItem, o: ProcessOpts = {}): Promise<WorkItem> => {
  let item = claimed;
  try {
    let proposal: Proposal = { ...item.proposal, summary: item.proposal?.summary ?? "", fields: item.proposal?.fields ?? {} };
    if (!o.preset) {
      const prep = await PERFORMERS[item.action].prepare(c, item);
      proposal = prep.proposal;
      item = await patchItem(c, item.id, { proposal, ...(prep.patch ?? {}) });
    }
    const rule = await loadRule(c, item.action);
    let v = evaluateGate({ department: item.department, action: item.action, rule, proposal });
    if (o.forceAsk) v = { verdict: "ask", reason: o.forceAsk, reasons: [o.forceAsk, ...v.reasons.filter((r) => r !== o.forceAsk && r !== "routine")], missing: v.missing };
    if (v.verdict === "auto") return await finish(c, item, proposal, { path: "auto", by: NIVO_BY, outcome: "auto_done" }, o.noChain);
    return await askHuman(c, item, proposal, v, rule);
  } catch (e) {
    return fail(c, item, e);
  }
};

/**
 * The one entry point for every AI step: dedupe → prepare (≤ 1 LLM call) → gate → perform + log, or ask.
 * A second call with the same dedupe key returns the existing item and logs `core.duplicate_blocked`.
 */
export const runWork = async (c: EngineCtx, spec: WorkSpec): Promise<WorkItem> => {
  const ins = await c.db.from("work_items").upsert({
    workspace_id: c.ws, department: ACTION_DEPARTMENT[spec.action], action: spec.action, subject_type: spec.subject_type, subject_id: spec.subject_id ?? null,
    lead_id: spec.lead_id ?? null, inbound_event_id: spec.inbound_event_id ?? null, parent_id: spec.parent_id ?? null, dedupe_key: spec.dedupeKey,
    status: "queued", proposal: { summary: "", fields: {}, ...(spec.seed ?? {}) }, origin: spec.origin,
  }, { onConflict: "workspace_id,dedupe_key", ignoreDuplicates: true }).select();
  if (ins.error) throw new Error(ins.error.message);
  const row = (ins.data ?? [])[0] as WorkItem | undefined;
  if (!row) {
    const existing = (await c.db.from("work_items").select("*").eq("workspace_id", c.ws).eq("dedupe_key", spec.dedupeKey).single()).data as WorkItem;
    await logEvidence(c.db, c.ws, { lead_id: existing?.lead_id ?? null, work_item_id: existing?.id ?? null, kind: "core.duplicate_blocked", actor: "NIVO", summary: tr(c)("workDuplicate"), evidence: spec.dedupeKey });
    return existing;
  }
  if (spec.queue) return row;
  const claimed = await claim(c, row);
  if (!claimed) return row;
  return processItem(c, claimed, { preset: spec.preset, noChain: spec.noChain, forceAsk: spec.forceAsk });
};

/** Queue the next department's step for a finished item (FLOW_NEXT). */
export const continueChain = async (c: EngineCtx, item: WorkItem): Promise<void> => {
  for (const next of FLOW_NEXT[item.action]) {
    const base = { action: next, parent_id: item.id, origin: item.origin, inbound_event_id: item.inbound_event_id, queue: true } as const;
    if (next === "classify_lead" && item.lead_id) {
      await runWork(c, { ...base, subject_type: "lead", subject_id: item.lead_id, lead_id: item.lead_id, dedupeKey: `classify_lead:after:${item.id}` });
    } else if (next === "send_follow_up" && item.lead_id) {
      if (item.proposal.fields?.stage === "lost") continue;
      if ((await getLead(c, item.lead_id))?.stage === "won") continue; // the customer already bought: no sales follow-up
      const pending = await c.db.from("work_items").select("id", { count: "exact", head: true }).eq("lead_id", item.lead_id).eq("action", "send_follow_up").eq("status", "waiting_decision");
      if ((pending.count ?? 0) > 0) continue; // one follow-up waiting per customer is enough
      await runWork(c, { ...base, subject_type: "lead", subject_id: item.lead_id, lead_id: item.lead_id, dedupeKey: `send_follow_up:after:${item.id}` });
    } else if (next === "issue_invoice" && item.subject_type === "order" && item.subject_id) {
      await runWork(c, { ...base, subject_type: "order", subject_id: item.subject_id, lead_id: item.lead_id, dedupeKey: `issue_invoice:order:${item.subject_id}` });
    } else if (next === "send_care" && (item.subject_type === "transaction" || item.subject_type === "invoice") && item.subject_id && item.lead_id) {
      // One care message per paid invoice, whichever way it was confirmed (a bank credit, or the owner checking a claim).
      const invoiceId = item.proposal.candidates?.length === 1 ? item.proposal.candidates[0].id : null;
      await runWork(c, {
        ...base, subject_type: item.subject_type, subject_id: item.subject_id, lead_id: item.lead_id,
        dedupeKey: invoiceId ? `send_care:invoice:${invoiceId}` : `send_care:transaction:${item.subject_id}`,
        seed: { fields: invoiceId ? { invoice_id: invoiceId } : {} },
      });
    }
  }
};

/** Process up to `limit` queued chain steps (oldest first). Called from `after()` and as a fallback from page loaders. */
export const runQueued = async (c: EngineCtx, limit = 2): Promise<number> => {
  let n = 0;
  for (let i = 0; i < limit; i++) {
    const { data } = await c.db.from("work_items").select("*").eq("workspace_id", c.ws).eq("status", "queued").is("reason", null).order("created_at").limit(10);
    const cand = ((data ?? []) as Array<WorkItem>).find((r) => r.updated_at === r.created_at || Date.now() - Date.parse(r.updated_at) > 120_000);
    if (!cand) break;
    const claimed = await claim(c, cand);
    if (!claimed) continue;
    await processItem(c, claimed);
    n += 1;
  }
  return n;
};

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * The decision resumes the same work: guarded transition (double clicks are safe), merge the human's edits,
 * reject → stop (with the action's undo), approve → gate with humanApproved → perform → log → continue the chain.
 */
export const resumeWork = async (
  c: EngineCtx, workItemId: string, decision: "approved" | "rejected", edits: WorkEdits, by: Decider, note?: string | null,
): Promise<WorkItem> => {
  const g = await c.db.from("work_items").update({ status: "queued", updated_at: now() }).eq("id", workItemId).eq("workspace_id", c.ws).eq("status", "waiting_decision").select();
  const item = ((g.data ?? [])[0] ?? null) as WorkItem | null;
  if (!item) throw new Error(tr(c)("alreadyDecided"));
  const before = item.proposal;

  const merged: Proposal = { ...before, fields: { ...(before.fields ?? {}) } };
  let changed = false;
  if (edits.draft !== undefined && edits.draft !== before.draft) {
    merged.draft = edits.draft;
    changed = true;
  }
  if (edits.amount_vnd !== undefined && !sameValue(edits.amount_vnd, before.amount_vnd)) {
    merged.amount_vnd = edits.amount_vnd;
    merged.fields.amount_vnd = edits.amount_vnd;
    changed = true;
  }
  for (const [k, v] of Object.entries(edits.fields ?? {})) {
    if (!sameValue(v, before.fields?.[k])) {
      merged.fields[k] = v;
      if (k === "amount_vnd") merged.amount_vnd = typeof v === "number" ? v : v === null ? null : Number(v) || null;
      changed = true;
    }
  }
  if (edits.candidateId && merged.candidates) merged.candidates = merged.candidates.filter((x) => x.id === edits.candidateId);

  if (decision === "rejected") {
    try {
      await PERFORMERS[item.action].onReject?.(c, item, merged, by);
      const rejected = await patchItem(c, item.id, { status: "rejected", decided_path: "human", proposal: merged, completed_at: now(), result: { summary: tr(c)("rejectedResult") } });
      await logDecision(c.db, c.ws, { work_item_id: item.id, lead_id: item.lead_id, department: item.department, action: item.action, decided_by: by.name, decider_kind: by.kind, outcome: "rejected", reason: item.reason, note: note ?? null, before, after: merged });
      await logEvidence(c.db, c.ws, { lead_id: item.lead_id, work_item_id: item.id, kind: "work.rejected", actor: by.name, summary: tr(c)("rejectedWork", { user: by.name, summary: before.summary }), evidence: note ?? null });
      await postOffice(c, { body: tr(c)("rejectedWork", { user: by.name, summary: before.summary }), lead_id: item.lead_id, work_item_id: item.id });
      await setInbound(c, item.inbound_event_id, { status: "processed" });
      return rejected;
    } catch (e) {
      await fail(c, item, e);
      throw e;
    }
  }

  // A person reviewed it: the outcome is clear unless a candidate still has to be chosen.
  if (merged.candidates && merged.candidates.length === 1) merged.outcome = "clear";
  if (!merged.candidates) {
    merged.outcome = "clear";
    if (typeof merged.confidence === "number" && merged.confidence < 1) merged.confidence = 1;
  }
  const rule = await loadRule(c, item.action);
  // humanApproved covers THIS item only (its own action, department and amount): see "Approval scope" above.
  const v = evaluateGate({ department: item.department, action: item.action, rule, proposal: merged, humanApproved: true });
  const blocking = v.reasons.filter((r) => r === "missing_data" || r === "unclear_outcome");
  if (blocking.length) {
    await patchItem(c, item.id, { status: "waiting_decision", proposal: { ...merged, candidates: before.candidates }, missing_fields: v.missing, reason: blocking[0], reasons: v.reasons });
    throw new Error(v.missing.length ? tr(c)("stillMissing", { fields: fieldLabels(c, v.missing) }) : tr(c)("chooseCandidate"));
  }
  try {
    return await finish(c, item, merged, { path: "human", by, outcome: changed ? "edited" : "approved", note: note ?? null, before });
  } catch (e) {
    await fail(c, item, e);
    throw e;
  }
};

/* ------------------------------------------------------------------ inputs → work (shared by the simulator and real channels) */

/** Start the department's work for one recorded input (inbound event). The same path for simulated and live inputs. */
export const startInboundWork = (c: EngineCtx, event: InboundEvent, action: FlowAction, seed: Partial<Proposal>, leadId: string | null = null) =>
  runWork(c, {
    action, subject_type: "inbound", subject_id: event.id, inbound_event_id: event.id, lead_id: leadId, origin: event.origin,
    dedupeKey: `${action}:inbound:${event.id}`, seed,
  });

/** An order input → Sales confirm_order through the gate (then Accounting issue_invoice by the chain). */
export const startOrderWork = (c: EngineCtx, event: InboundEvent, o: { items: string; amount_vnd: number | null; lead_id?: string | null }) =>
  startInboundWork(c, event, "confirm_order", { amount_vnd: o.amount_vnd, fields: { items: o.items, amount_vnd: o.amount_vnd } }, o.lead_id ?? null);

/** The customer's latest payment record, open ("issued") or already paid. */
export const latestInvoiceFor = async (c: EngineCtx, leadId: string, status: "issued" | "paid") =>
  (((await c.db.from("invoices").select("*").eq("workspace_id", c.ws).eq("lead_id", leadId).eq("status", status)
    .order(status === "paid" ? "paid_at" : "created_at", { ascending: false }).limit(1)).data ?? [])[0] ?? null) as Invoice | null;

/**
 * The customer says they paid an open payment record. A claim is not evidence: it becomes ONE reconcile_payment item per
 * invoice that waits for the owner (unclear_outcome, the invoice as the single candidate), who checks the bank and approves
 * with a basis. Nothing is marked paid here. A repeated claim while one is open (or already confirmed) creates nothing new.
 */
export const startPaymentClaim = async (
  c: EngineCtx, inv: Invoice, a: { event: InboundEvent; claim: string; channelLabel: string; conversationId: string },
): Promise<{ item: WorkItem; created: boolean }> => {
  const open = ((await c.db.from("work_items").select("*").eq("workspace_id", c.ws).eq("action", "reconcile_payment")
    .like("dedupe_key", `${claimKey(inv.id)}%`).order("created_at", { ascending: false }).limit(1)).data ?? [])[0] as WorkItem | undefined;
  if (open && !["rejected", "failed"].includes(open.status)) {
    await logEvidence(c.db, c.ws, { lead_id: inv.lead_id, work_item_id: open.id, kind: "core.duplicate_blocked", actor: "NIVO", summary: tr(c)("workDuplicate"), evidence: a.claim.slice(0, 300) });
    return { item: open, created: false };
  }
  const lead = await getLead(c, inv.lead_id);
  const name = lead?.contact_name ?? "—";
  const item = await runWork(c, {
    action: "reconcile_payment", subject_type: "invoice", subject_id: inv.id, lead_id: inv.lead_id, inbound_event_id: a.event.id, origin: a.event.origin,
    // After a rejected claim the customer may claim again: that is a new check.
    dedupeKey: open ? `${claimKey(inv.id)}:${a.event.id}` : claimKey(inv.id), preset: true, forceAsk: "unclear_outcome",
    seed: {
      summary: tr(c)("claimSummary", { name, amount: vnd(c, inv.amount_vnd), no: inv.invoice_no, channel: a.channelLabel }),
      amount_vnd: inv.amount_vnd, outcome: "unclear",
      candidates: [{ id: inv.id, label: tr(c)("candidateLabel", { no: inv.invoice_no, name, amount: vnd(c, inv.amount_vnd) }), amount_vnd: inv.amount_vnd }],
      fields: { amount_vnd: inv.amount_vnd, reference: inv.invoice_no, payer: name, claim: a.claim.slice(0, 500), conversation_id: a.conversationId },
    },
  });
  return { item, created: true };
};
