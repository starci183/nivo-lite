import "server-only";
import { drainAfter, engineCtx } from "./flow-ctx";
import { listDecisions, listWorkItems } from "./flow-queries";
import type { DecisionRow, EvidenceState, FlowAction, Invoice, Order, ReasonCode, WorkItemView } from "./flow-types";
import type { Execution, Lead, LeadStage, Responsibility } from "./types";

/**
 * Data for the Sales workbench (five surfaces). Everything is read from the tables the flow already writes
 * (leads, responsibilities, work_items, executions, orders, invoices, decisions, events, conversations): nothing is invented.
 */

const MIN = 60_000;
const OPEN_STAGES: ReadonlyArray<LeadStage> = ["new", "qualified", "proposal"];
const AWAITING_REPLY_AFTER_MS = 3 * MIN;
const BOARD_CLOSED_LIMIT = 8;

export type AttentionKind = "decision" | "failed" | "clarify" | "overdue" | "awaiting_reply";

/** One opportunity that needs a person: what is needed, since when, who owns it and the one primary action. */
export type AttentionRow = {
  key: string;
  kind: AttentionKind;
  leadId: string | null;
  customer: string;
  company: string;
  stage: LeadStage | null;
  /** the need in one line: what NIVO proposes, the missing data, the overdue step or the customer's last message */
  need: string;
  since: string;
  owner: string | null;
  workItemId: string | null;
  /** the pending decision this row opens in the Decisions surface (work item or legacy approval card) */
  decisionId: string | null;
  action: FlowAction | null;
  /** the fields NIVO is missing (clarification) */
  missing: ReadonlyArray<string>;
};

/** A card on the pipeline board. */
export type SalesDeal = {
  leadId: string;
  customer: string;
  company: string;
  channel: string;
  need: string;
  stage: LeadStage;
  valueVnd: number | null;
  valueSource: "order" | "quote" | null;
  nextStep: string | null;
  dueAt: string | null;
  owner: string | null;
  createdAt: string;
  /** why the deal was closed (won or lost), from the outcome evidence; null while open */
  closedReason: string | null;
  closedAt: string | null;
};

export type SalesDecision = {
  id: string;
  source: "work_item" | "execution";
  workItemId: string | null;
  executionId: string | null;
  leadId: string | null;
  customer: string;
  action: FlowAction | "follow_up";
  reason: ReasonCode | null;
  summary: string;
  draft: string;
  amountVnd: number | null;
  /** true when the amount is part of what the person can set (a quote or an order) */
  hasAmount: boolean;
  missing: ReadonlyArray<string>;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  createdAt: string;
};

export type HandoffRow = {
  key: string;
  orderId: string | null;
  leadId: string | null;
  customer: string;
  orderNo: string | null;
  items: string;
  amountVnd: number | null;
  orderStatus: Order["status"] | "won_without_order";
  confirmedAt: string | null;
  invoice: { no: string; status: Invoice["status"]; amountVnd: number; issuedAt: string | null; paidAt: string | null } | null;
  /** the accounting step for this order (invoice) when one exists */
  work: { id: string; status: WorkItemView["status"]; reason: ReasonCode | null; error: string | null } | null;
  canHandoff: boolean;
};

export type AutoActivity = {
  id: string;
  action: FlowAction;
  leadId: string | null;
  customer: string | null;
  summary: string;
  at: string;
  evidenceState: EvidenceState;
  evidence: string | null;
  href: string;
};

export type SalesMetrics = {
  openCount: number;
  proposalValueVnd: number;
  proposalCount: number;
  wonCount: number;
  wonValueVnd: number;
  waitingCount: number;
};

export type SalesWorkbenchData = {
  nowIso: string;
  metrics: SalesMetrics;
  attention: ReadonlyArray<AttentionRow>;
  deals: ReadonlyArray<SalesDeal>;
  /** closed deals beyond the board's per-column limit (so the board can say "N more") */
  closedHidden: { won: number; lost: number };
  decisions: ReadonlyArray<SalesDecision>;
  decided: ReadonlyArray<DecisionRow>;
  handoffs: ReadonlyArray<HandoffRow>;
  activity: ReadonlyArray<AutoActivity>;
  staff: ReadonlyArray<{ id: string; name: string }>;
};

const PRIORITY: Record<AttentionKind, number> = { decision: 0, failed: 1, clarify: 2, overdue: 3, awaiting_reply: 4 };

/** Start of the current month in Vietnam time (UTC+7), as an ISO instant. */
const monthStartIso = (now: number): string => {
  const vn = new Date(now + 7 * 3_600_000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1) - 7 * 3_600_000).toISOString();
};

const clip = (text: string, n = 140): string => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

const strField = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

type ConversationRow = { id: string; lead_id: string | null; visitor_name: string | null; handled_by: string | null };
type MessageRow = { conversation_id: string; role: "user" | "agent" | "system"; body: string; created_at: string };
type EventSlim = { lead_id?: string | null; work_item_id?: string | null; summary?: string; evidence: string | null; created_at: string };
type ExecutionRow = Pick<Execution, "id" | "responsibility_id" | "draft" | "created_at">;

/** Load the whole Sales workbench for the signed-in workspace. */
export const getSalesWorkbench = async (): Promise<SalesWorkbenchData> => {
  const c = await engineCtx();
  const { db, ws } = c;
  drainAfter(c);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const monthStart = monthStartIso(nowMs);

  const [leadsRes, respRes, ordersRes, invoicesRes, convRes, execRes, staffRes, outcomeRes, items, humanDecided] = await Promise.all([
    db.from("leads").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(500),
    db.from("responsibilities").select("*").eq("workspace_id", ws).neq("status", "done").order("due_at", { ascending: true, nullsFirst: false }).limit(500),
    db.from("orders").select("*").eq("workspace_id", ws).neq("status", "draft").order("created_at", { ascending: false }).limit(200),
    db.from("invoices").select("*").eq("workspace_id", ws).limit(500),
    db.from("agent_conversations").select("id, lead_id, visitor_name, handled_by").eq("workspace_id", ws).eq("kind", "customer").not("lead_id", "is", null).limit(200),
    db.from("executions").select("id, responsibility_id, draft, created_at").eq("workspace_id", ws).eq("status", "pending_approval").is("work_item_id", null).limit(50),
    db.from("staff").select("id, name").eq("workspace_id", ws).eq("active", true).order("created_at"),
    db.from("events").select("lead_id, evidence, actor, created_at").eq("workspace_id", ws).eq("kind", "outcome.recorded").order("created_at", { ascending: false }).limit(600),
    listWorkItems({ limit: 400 }),
    listDecisions({ kind: "human", department: "sales", limit: 15 }),
  ]);

  const leads = (leadsRes.data ?? []) as Array<Lead>;
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const responsibilities = (respRes.data ?? []) as Array<Responsibility>;
  const orders = ((ordersRes.data ?? []) as Array<Order>).filter((o) => o.status !== "cancelled");
  const invoices = (invoicesRes.data ?? []) as Array<Invoice>;
  const conversations = (convRes.data ?? []) as Array<ConversationRow>;
  const executions = (execRes.data ?? []) as Array<ExecutionRow>;
  const outcomes = (outcomeRes.data ?? []) as Array<EventSlim & { actor: string }>;

  /* ---- per-lead lookups ---- */
  const openRespByLead = new Map<string, Responsibility>();
  for (const r of responsibilities) if (!openRespByLead.has(r.lead_id)) openRespByLead.set(r.lead_id, r);
  const ownerOf = (leadId: string | null, item?: WorkItemView | null): string | null =>
    item?.assignedStaffName ?? (leadId ? openRespByLead.get(leadId)?.owner_name ?? null : null);

  const orderByLead = new Map<string, Order>();
  for (const o of orders) if (o.lead_id && !orderByLead.has(o.lead_id)) orderByLead.set(o.lead_id, o); // newest first
  const quoteByLead = new Map<string, number>();
  for (const w of items) {
    if (w.action === "send_quote" && w.lead_id && w.status !== "rejected" && typeof w.proposal.amount_vnd === "number" && !quoteByLead.has(w.lead_id)) {
      quoteByLead.set(w.lead_id, w.proposal.amount_vnd);
    }
  }
  const waitingByLead = new Map<string, WorkItemView>();
  for (const w of items) if (w.lead_id && w.status === "waiting_decision" && !waitingByLead.has(w.lead_id)) waitingByLead.set(w.lead_id, w);
  const closedByLead = new Map<string, { reason: string | null; at: string }>();
  for (const e of outcomes) if (e.lead_id && !closedByLead.has(e.lead_id)) closedByLead.set(e.lead_id, { reason: e.evidence, at: e.created_at });

  /* ---- deals (the board) ---- */
  const toDeal = (l: Lead): SalesDeal => {
    const order = orderByLead.get(l.id);
    const quote = quoteByLead.get(l.id);
    const valueVnd = order?.amount_vnd ?? quote ?? null;
    const resp = openRespByLead.get(l.id);
    const closed = l.stage === "won" || l.stage === "lost" ? closedByLead.get(l.id) : undefined;
    return {
      leadId: l.id, customer: l.contact_name, company: l.company, channel: l.channel, need: l.need, stage: l.stage, valueVnd,
      valueSource: order?.amount_vnd != null ? "order" : quote != null ? "quote" : null,
      nextStep: resp?.next_action || waitingByLead.get(l.id)?.proposal.summary || null,
      dueAt: resp?.due_at ?? null,
      owner: ownerOf(l.id, waitingByLead.get(l.id)),
      createdAt: l.created_at, closedReason: closed?.reason ?? null, closedAt: closed?.at ?? null,
    };
  };
  const allDeals = leads.map(toDeal);
  const openDeals = allDeals.filter((d) => OPEN_STAGES.includes(d.stage));
  const closedDeals = (stage: "won" | "lost") => allDeals.filter((d) => d.stage === stage).sort((a, b) => (b.closedAt ?? b.createdAt).localeCompare(a.closedAt ?? a.createdAt));
  const won = closedDeals("won");
  const lost = closedDeals("lost");
  const deals = [...openDeals, ...won.slice(0, BOARD_CLOSED_LIMIT), ...lost.slice(0, BOARD_CLOSED_LIMIT)];

  /* ---- decisions ---- */
  const salesWaiting = items.filter((w) => w.department === "sales" && w.status === "waiting_decision");
  const decisions: Array<SalesDecision> = salesWaiting.map((w) => ({
    id: w.id, source: "work_item", workItemId: w.id, executionId: null, leadId: w.lead_id, customer: w.lead?.contact_name ?? (strField(w.proposal.fields?.customer) || "—"),
    action: w.action, reason: w.reason, summary: w.proposal.summary, draft: w.proposal.draft ?? "",
    amountVnd: typeof w.proposal.amount_vnd === "number" ? w.proposal.amount_vnd : null,
    hasAmount: w.proposal.amount_vnd !== undefined || w.missing_fields.includes("amount_vnd"),
    missing: w.missing_fields, assignedStaffId: w.assigned_staff_id, assignedStaffName: w.assignedStaffName, createdAt: w.created_at,
  }));
  const respById = new Map(responsibilities.map((r) => [r.id, r]));
  for (const ex of executions) {
    const r = respById.get(ex.responsibility_id);
    const lead = r ? leadById.get(r.lead_id) : undefined;
    decisions.push({
      id: ex.id, source: "execution", workItemId: null, executionId: ex.id, leadId: lead?.id ?? null, customer: lead?.contact_name ?? "—", action: "follow_up",
      reason: null, summary: r?.next_action ?? "", draft: ex.draft, amountVnd: null, hasAmount: false, missing: [], assignedStaffId: null, assignedStaffName: null, createdAt: ex.created_at,
    });
  }
  decisions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  /* ---- attention ---- */
  const attention: Array<AttentionRow> = [];
  const stageOf = (leadId: string | null): LeadStage | null => (leadId ? leadById.get(leadId)?.stage ?? null : null);
  const leadName = (id: string | null): { customer: string; company: string } => {
    const l = id ? leadById.get(id) : undefined;
    return { customer: l?.contact_name ?? "—", company: l?.company ?? "" };
  };
  for (const d of decisions) {
    const isClarify = d.missing.length > 0;
    attention.push({
      key: `decision:${d.id}`, kind: isClarify ? "clarify" : "decision", leadId: d.leadId, ...leadName(d.leadId), customer: d.customer, stage: stageOf(d.leadId),
      need: clip(d.summary), since: d.createdAt, owner: d.assignedStaffName ?? (d.leadId ? openRespByLead.get(d.leadId)?.owner_name ?? null : null),
      workItemId: d.workItemId, decisionId: d.id, action: d.action === "follow_up" ? "send_follow_up" : d.action, missing: d.missing,
    });
  }
  for (const w of items) {
    if (w.department !== "sales" || w.status !== "failed") continue;
    attention.push({
      key: `failed:${w.id}`, kind: "failed", leadId: w.lead_id, customer: w.lead?.contact_name ?? "—", company: w.lead?.company ?? "", stage: stageOf(w.lead_id),
      need: clip(w.error || w.proposal.summary), since: w.updated_at, owner: ownerOf(w.lead_id, w), workItemId: w.id, decisionId: null, action: w.action, missing: [],
    });
  }
  for (const r of responsibilities) {
    const lead = leadById.get(r.lead_id);
    if (!lead || !OPEN_STAGES.includes(lead.stage) || !r.due_at || Date.parse(r.due_at) >= nowMs || r.status === "waiting_approval") continue;
    attention.push({
      key: `overdue:${r.id}`, kind: "overdue", leadId: lead.id, customer: lead.contact_name, company: lead.company, stage: lead.stage,
      need: clip(r.next_action || r.title), since: r.due_at, owner: r.owner_name, workItemId: null, decisionId: null, action: null, missing: [],
    });
  }

  const convIds = conversations.map((x) => x.id);
  if (convIds.length) {
    const msgRes = await db.from("agent_messages").select("conversation_id, role, body, created_at").in("conversation_id", convIds).order("created_at", { ascending: false }).limit(800);
    const latest = new Map<string, MessageRow>();
    for (const m of (msgRes.data ?? []) as Array<MessageRow>) if (!latest.has(m.conversation_id)) latest.set(m.conversation_id, m);
    const seen = new Set<string>();
    for (const conv of conversations) {
      const m = latest.get(conv.id);
      const lead = conv.lead_id ? leadById.get(conv.lead_id) : undefined;
      if (!m || m.role !== "user" || !lead || !OPEN_STAGES.includes(lead.stage) || seen.has(lead.id)) continue;
      if (nowMs - Date.parse(m.created_at) < AWAITING_REPLY_AFTER_MS) continue;
      seen.add(lead.id);
      attention.push({
        key: `reply:${conv.id}`, kind: "awaiting_reply", leadId: lead.id, customer: lead.contact_name, company: lead.company, stage: lead.stage,
        need: clip(m.body), since: m.created_at, owner: conv.handled_by ?? openRespByLead.get(lead.id)?.owner_name ?? null, workItemId: null, decisionId: null, action: null, missing: [],
      });
    }
  }
  attention.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.since.localeCompare(b.since));

  /* ---- hand-offs to Accounting ---- */
  const invoiceByOrder = new Map<string, Invoice>();
  for (const i of invoices) if (i.order_id && i.status !== "void") invoiceByOrder.set(i.order_id, i);
  const invoiceWorkBySubject = new Map<string, WorkItemView>();
  for (const w of items) if (w.action === "issue_invoice" && w.subject_id && !invoiceWorkBySubject.has(w.subject_id)) invoiceWorkBySubject.set(w.subject_id, w);
  const slimWork = (w: WorkItemView | undefined): HandoffRow["work"] => (w ? { id: w.id, status: w.status, reason: w.reason, error: w.error } : null);
  const handoffs: Array<HandoffRow> = orders.map((o) => {
    const inv = invoiceByOrder.get(o.id);
    const work = invoiceWorkBySubject.get(o.id);
    const noActive = !work || work.status === "rejected";
    return {
      key: `order:${o.id}`, orderId: o.id, leadId: o.lead_id, customer: leadName(o.lead_id).customer, orderNo: o.order_no, items: o.items, amountVnd: o.amount_vnd,
      orderStatus: o.status, confirmedAt: o.confirmed_at,
      invoice: inv ? { no: inv.invoice_no, status: inv.status, amountVnd: inv.amount_vnd, issuedAt: inv.issued_at, paidAt: inv.paid_at } : null,
      work: slimWork(work), canHandoff: o.status === "confirmed" && !inv && noActive,
    };
  });
  const leadsWithOrder = new Set(orders.map((o) => o.lead_id).filter((x): x is string => !!x));
  for (const l of leads) {
    if (l.stage !== "won" || leadsWithOrder.has(l.id)) continue;
    handoffs.push({
      key: `lead:${l.id}`, orderId: null, leadId: l.id, customer: l.contact_name, orderNo: null, items: l.need, amountVnd: quoteByLead.get(l.id) ?? null,
      orderStatus: "won_without_order", confirmedAt: closedByLead.get(l.id)?.at ?? null, invoice: null, work: slimWork(invoiceWorkBySubject.get(l.id)), canHandoff: false,
    });
  }
  handoffs.sort((a, b) => (b.confirmedAt ?? "").localeCompare(a.confirmedAt ?? ""));

  /* ---- automatic activity (done by policy) with evidence ---- */
  const autoDone = items.filter((w) => w.department === "sales" && w.status === "done" && w.decided_path === "auto").slice(0, 40);
  const evidenceByItem = new Map<string, string>();
  if (autoDone.length) {
    const ev = await db.from("events").select("work_item_id, evidence, summary, created_at").in("work_item_id", autoDone.map((w) => w.id)).eq("kind", "work.auto_done");
    for (const e of (ev.data ?? []) as Array<EventSlim>) if (e.work_item_id && !evidenceByItem.has(e.work_item_id)) evidenceByItem.set(e.work_item_id, e.evidence ?? "");
  }
  const activity: Array<AutoActivity> = autoDone.map((w) => ({
    id: w.id, action: w.action, leadId: w.lead_id, customer: w.lead?.contact_name ?? null, summary: w.result?.summary ?? w.proposal.summary,
    at: w.completed_at ?? w.updated_at, evidenceState: w.evidence_state, evidence: evidenceByItem.get(w.id) || null, href: w.result?.href ?? w.href,
  }));

  /* ---- header metrics ---- */
  const wonIds = new Set<string>();
  let wonValueVnd = 0;
  for (const o of orders) {
    if (o.confirmed_at && o.confirmed_at >= monthStart && o.lead_id && leadById.get(o.lead_id)?.stage === "won") {
      wonIds.add(o.lead_id);
      wonValueVnd += o.amount_vnd ?? 0;
    }
  }
  for (const e of outcomes) {
    if (e.created_at >= monthStart && e.lead_id && leadById.get(e.lead_id)?.stage === "won") wonIds.add(e.lead_id);
  }
  const proposalDeals = openDeals.filter((d) => d.stage === "proposal");
  const metrics: SalesMetrics = {
    openCount: openDeals.length,
    proposalValueVnd: proposalDeals.reduce((s, d) => s + (d.valueVnd ?? 0), 0),
    proposalCount: proposalDeals.length,
    wonCount: wonIds.size,
    wonValueVnd,
    waitingCount: decisions.length,
  };

  return {
    nowIso, metrics, attention, deals, closedHidden: { won: Math.max(0, won.length - BOARD_CLOSED_LIMIT), lost: Math.max(0, lost.length - BOARD_CLOSED_LIMIT) },
    decisions, decided: humanDecided, handoffs, activity, staff: ((staffRes.data ?? []) as Array<{ id: string; name: string }>),
  };
};
