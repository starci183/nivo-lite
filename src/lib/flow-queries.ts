import "server-only";
import { cache } from "react";
import { drainAfter, engineCtx } from "./flow-ctx";
import type { EngineCtx } from "./engine";
import { listModules } from "./module-registry";
import type {
  Authority, AuthorityRule, DecisionRow, Department, Governance, InboundEvent, Invoice, LeadFlow, Order, ReasonCode, Staff, Transaction,
  WorkItem, WorkItemView, WorkStatus,
} from "./flow-types";

const DAY = 86_400_000;
const WORK_SELECT = "*, lead:leads(id, contact_name, company, channel), staff:staff(name)";

type WorkRow = WorkItem & { lead: WorkItemView["lead"]; staff: { name: string } | null; decisions?: Array<{ decided_by: string; created_at: string }> };

const WORK_SELECT_WITH_DECIDER = `${WORK_SELECT}, decisions(decided_by, created_at)`;

const toView = ({ staff, decisions, ...w }: WorkRow): WorkItemView => ({
  ...w,
  proposal: w.proposal ?? { summary: "", fields: {} },
  lead: w.lead ?? null,
  assignedStaffName: staff?.name ?? null,
  hasApprovalCard: w.execution_id !== null,
  href: w.lead_id ? `/leads/${w.lead_id}` : w.department === "inventory" ? "/m/inventory/workbench?tab=orders" : w.department === "shifts" ? "/m/shifts/workbench" : "/chat",
  ...(decisions ? { decidedBy: [...decisions].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1)?.decided_by ?? null } : {}),
});

type DecisionDb = Omit<DecisionRow, "leadName"> & { lead: { contact_name: string } | null };
const toDecision = ({ lead, ...d }: DecisionDb): DecisionRow => ({
  id: d.id, work_item_id: d.work_item_id, lead_id: d.lead_id, leadName: lead?.contact_name ?? null, department: d.department, action: d.action,
  decided_by: d.decided_by, decider_kind: d.decider_kind, outcome: d.outcome, reason: d.reason, note: d.note, created_at: d.created_at,
});

/** The owner's authority (goals, policies, reply style, brand voice, limits note). */
export const getAuthority = cache(async (): Promise<Authority> => {
  const { db, ws } = await engineCtx();
  const { data } = await db.from("authority").select("*").eq("workspace_id", ws).maybeSingle();
  return (data as Authority | null) ?? {
    workspace_id: ws, goal_revenue_vnd: null, goal_new_customers: null, goal_first_reply_minutes: null, goal_note: "", policies: "",
    reply_style: "", brand_voice: "", limits_note: "", updated_by: null, updated_at: new Date().toISOString(),
  };
});

const ORDER: Record<string, number> = { chatbot: 0, sales: 1, accounting: 2 };
const ACTION_ORDER = ["reply_customer", "handoff_lead", "classify_lead", "send_follow_up", "send_quote", "confirm_order", "send_care", "issue_invoice", "reconcile_payment", "send_email"];

/** Department × action rules, grouped Chatbot → Sales → Accounting in flow order. */
export const listRules = cache(async (): Promise<Array<AuthorityRule>> => {
  const { db, ws } = await engineCtx();
  const { data } = await db.from("authority_rules").select("*").eq("workspace_id", ws);
  return ((data ?? []) as Array<AuthorityRule>).sort((a, b) => ORDER[a.department] - ORDER[b.department] || ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action));
});

/** Optional staff (active first). */
export const listStaff = cache(async (): Promise<Array<Staff>> => {
  const { db, ws } = await engineCtx();
  const { data } = await db.from("staff").select("*").eq("workspace_id", ws).order("active", { ascending: false }).order("created_at");
  return (data ?? []) as Array<Staff>;
});

/** Latest inputs first. */
export const listInbound = async (limit = 30): Promise<Array<InboundEvent>> => {
  const { db, ws } = await engineCtx();
  const { data } = await db.from("inbound_events").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as Array<InboundEvent>;
};

/** Items waiting for a decision plus failed ones, oldest first. `hasApprovalCard` = a legacy approval card already shows it. */
export const listExceptions = cache(async (): Promise<Array<WorkItemView>> => {
  const c = await engineCtx();
  drainAfter(c);
  const { data } = await c.db.from("work_items").select(WORK_SELECT).eq("workspace_id", c.ws).in("status", ["waiting_decision", "failed"]).order("created_at").limit(100);
  return workViewsFrom((data ?? []) as Array<WorkRow>);
});

/** Work items as the app shows them, from rows already read (the SQL page functions return the same shape, lead and staff embedded). */
export const workViewsFrom = (rows: ReadonlyArray<unknown>): Array<WorkItemView> => (rows as Array<WorkRow>).map(toView);

/** Work items, newest first (or in flow order for one lead). */
export const listWorkItems = async (filter: { status?: Array<WorkStatus>; leadId?: string; limit?: number; withDecider?: boolean } = {}): Promise<Array<WorkItemView>> => {
  const { db, ws } = await engineCtx();
  let q = db.from("work_items").select(filter.withDecider ? WORK_SELECT_WITH_DECIDER : WORK_SELECT).eq("workspace_id", ws);
  if (filter.status?.length) q = q.in("status", filter.status);
  if (filter.leadId) q = q.eq("lead_id", filter.leadId);
  const { data } = await q.order("created_at", { ascending: !!filter.leadId }).limit(filter.limit ?? 50);
  return ((data ?? []) as unknown as Array<WorkRow>).map(toView);
};

/** Decision history: policy (NIVO) and human decisions, newest first. kind: policy | human | rejected. */
export const listDecisions = async (filter: { kind?: "policy" | "human" | "rejected"; department?: Department; limit?: number } = {}): Promise<Array<DecisionRow>> => {
  const { db, ws } = await engineCtx();
  let q = db.from("decisions").select("*, lead:leads(contact_name)").eq("workspace_id", ws);
  if (filter.kind === "policy") q = q.eq("decider_kind", "policy");
  if (filter.kind === "human") q = q.in("decider_kind", ["owner", "staff"]);
  if (filter.kind === "rejected") q = q.eq("outcome", "rejected");
  if (filter.department) q = q.eq("department", filter.department);
  const { data } = await q.order("created_at", { ascending: false }).limit(filter.limit ?? 100);
  return ((data ?? []) as Array<DecisionDb>).map(toDecision);
};

const median = (xs: Array<number>) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * TEST-RUN RULE (the one place it lives). A record is test data when a name it carries matches /UAT|DBG/:
 * the UAT scripts tag every sender, payer, reference and item with "UAT-xxxx"; debug runs use "DBG".
 * Names checked: a lead's contact_name/company; a work item's lead plus its proposal summary and customer fields;
 * an order's items/order_no; an invoice's invoice_no; a payment's payer/reference. Records linked to a test lead,
 * order, invoice or work item inherit the flag. Test records are excluded from EVERY dashboard figure (getGovernance
 * and the dashboard's waiting list); they stay visible in Office, leads and the decisions log. Case-sensitive on purpose.
 */
export const TEST_RUN_PATTERN = /UAT|DBG/;

/** True when any of the given names marks a test run (see TEST_RUN_PATTERN). */
export const isTestRunName = (...names: ReadonlyArray<string | null | undefined>): boolean =>
  names.some((name) => typeof name === "string" && TEST_RUN_PATTERN.test(name));

/** True when a work item belongs to a test run: its lead or its proposal carries a test-run name (see TEST_RUN_PATTERN). */
export const isTestRunWorkItem = (item: Pick<WorkItemView, "lead" | "proposal">): boolean =>
  isTestRunName(
    item.lead?.contact_name, item.lead?.company, item.proposal?.summary,
    String(item.proposal?.fields?.contact_name ?? ""), String(item.proposal?.fields?.customer ?? ""),
  );

/** Amounts or counts split by where the records came from. `unlabelled` = rows with no origin (older seed/legacy leads). */
export type OriginSplit = { live: number; simulated: number; unlabelled: number };
/** One status figure: money and record count, each split by origin. Never summed into one headline. */
export type StatusFigure = { vnd: OriginSplit; count: OriginSplit };
/** Results reported by status, each with the evidence it rests on, test runs excluded. */
export type StatusResults = {
  /** Orders confirmed by NIVO or a person (status confirmed / invoiced / paid). */
  confirmedOrders: StatusFigure;
  /** Internal payment records (invoices issued / paid). No e-invoice (HĐĐT) is issued by this build. */
  internalInvoices: StatusFigure;
  /** Payments matched to an internal invoice (status matched with an invoice link = the evidence). */
  matchedPayments: StatusFigure;
  /** Money received but not verified yet: unmatched, needs review, or matched without an invoice link. */
  pendingVerification: StatusFigure;
  newLeads7d: OriginSplit;
  wonLeads: OriginSplit;
  /** Completed service / recognised revenue is not tracked in this build: always null. */
  serviceCompleted: null;
  /** Records dropped by the test-run rule (leads, orders, invoices, payments, work items). */
  excludedTestRecords: number;
};
/** getGovernance's result: the shared Governance shape plus the status-with-evidence results. */
export type GovernanceWithStatus = Governance & { status: StatusResults };

const emptySplit = (): OriginSplit => ({ live: 0, simulated: 0, unlabelled: 0 });
const originKey = (origin: string | null): keyof OriginSplit => (origin === "live" ? "live" : origin === "simulated" ? "simulated" : "unlabelled");
const splitCount = (rows: ReadonlyArray<{ origin: string | null }>): OriginSplit =>
  rows.reduce((s, r) => { s[originKey(r.origin)] += 1; return s; }, emptySplit());
const figure = (rows: ReadonlyArray<{ origin: string | null; amount_vnd: number | null }>): StatusFigure => ({
  vnd: rows.reduce((s, r) => { s[originKey(r.origin)] += r.amount_vnd ?? 0; return s; }, emptySplit()),
  count: splitCount(rows),
});

/**
 * Governance for /dashboard and the shell: goals vs results by status (live and simulated kept apart), auto vs asked,
 * pending decisions (waiting work items + legacy pending approvals with no work item, counted once), exceptions, departments.
 * Test runs (see TEST_RUN_PATTERN) are excluded from every figure.
 * Legacy `results`: confirmedVnd = orders confirmed/invoiced/paid; invoicedVnd = invoices issued/paid; collectedVnd = payments
 * matched to an invoice (each live + simulated, test runs excluded; the dashboard shows `status` so they are never one headline).
 * `simulated`/`total` count those orders, invoices and payments plus leads created in 7 days.
 */
/** The rows behind the governance figures, as `fetchGovernanceRows` reads them and as the SQL function `governance_rows` returns them. */
export type GovernanceRows = {
  auth: { goal_revenue_vnd: number | null; goal_new_customers: number | null; goal_first_reply_minutes: number | null } | null;
  leads: Array<unknown>; orders: Array<unknown>; invoices: Array<unknown>; txs: Array<unknown>; work: Array<unknown>;
  pending_without_work: number; decisions7: Array<unknown>; recent: Array<unknown>;
};

const fetchGovernanceRows = async (db: EngineCtx["db"], ws: string, since7: string): Promise<GovernanceRows> => {
  const [auth, leadsQ, orders, invoices, txs, work, pendingEx, decisions7, recent] = await Promise.all([
    db.from("authority").select("goal_revenue_vnd, goal_new_customers, goal_first_reply_minutes").eq("workspace_id", ws).maybeSingle(),
    db.from("leads").select("id, contact_name, company, origin, stage, created_at").eq("workspace_id", ws).limit(10000),
    db.from("orders").select("id, lead_id, order_no, items, amount_vnd, status, origin").eq("workspace_id", ws).in("status", ["confirmed", "invoiced", "paid"]),
    db.from("invoices").select("id, order_id, lead_id, invoice_no, amount_vnd, status, origin").eq("workspace_id", ws).in("status", ["issued", "paid"]),
    db.from("transactions").select("id, invoice_id, payer, reference, amount_vnd, status, origin").eq("workspace_id", ws).in("status", ["matched", "unmatched", "needs_review"]),
    db.from("work_items")
      .select("id, lead_id, department, status, reason, decided_path, created_at, updated_at, completed_at, summary:proposal->>summary, contact:proposal->fields->>contact_name, customer:proposal->fields->>customer")
      .eq("workspace_id", ws).order("created_at", { ascending: false }).limit(2000),
    db.from("executions").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "pending_approval").is("work_item_id", null),
    db.from("decisions").select("work_item_id, lead_id, decider_kind, outcome, created_at").eq("workspace_id", ws).gte("created_at", since7),
    db.from("decisions").select("*, lead:leads(contact_name)").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(40),
  ]);
  return {
    auth: (auth.data as GovernanceRows["auth"]) ?? null, leads: leadsQ.data ?? [], orders: orders.data ?? [], invoices: invoices.data ?? [], txs: txs.data ?? [],
    work: work.data ?? [], pending_without_work: pendingEx.count ?? 0, decisions7: decisions7.data ?? [], recent: recent.data ?? [],
  };
};

export const getGovernance = cache(async (): Promise<GovernanceWithStatus> => {
  const c = await engineCtx();
  drainAfter(c);
  const since7 = new Date(Date.now() - 7 * DAY).toISOString();
  return governanceFrom(await fetchGovernanceRows(c.db, c.ws, since7), since7);
});

/** The governance figures from already-read rows (see `governance_rows`); `since7` is the ISO start of the 7-day window the rows were read with. */
export const governanceFrom = (rows: GovernanceRows, since7: string): GovernanceWithStatus => {
  // Test-run exclusion (TEST_RUN_PATTERN), propagated lead → order → invoice → payment and lead → work item → decision.
  type LeadRow = { id: string; contact_name: string | null; company: string | null; origin: string | null; stage: string; created_at: string };
  const allLeads = rows.leads as Array<LeadRow>;
  const testLeads = new Set(allLeads.filter((x) => isTestRunName(x.contact_name, x.company)).map((x) => x.id));
  const isTestLead = (id: string | null) => id !== null && testLeads.has(id);
  type OrderRow = { id: string; lead_id: string | null; order_no: string | null; items: string | null; amount_vnd: number | null; origin: string | null };
  const allOrders = rows.orders as Array<OrderRow>;
  const testOrders = new Set(allOrders.filter((x) => isTestLead(x.lead_id) || isTestRunName(x.items, x.order_no)).map((x) => x.id));
  type InvoiceRow = { id: string; order_id: string | null; lead_id: string | null; invoice_no: string | null; amount_vnd: number | null; origin: string | null };
  const allInvoices = rows.invoices as Array<InvoiceRow>;
  const testInvoices = new Set(allInvoices
    .filter((x) => isTestLead(x.lead_id) || (x.order_id !== null && testOrders.has(x.order_id)) || isTestRunName(x.invoice_no)).map((x) => x.id));
  type TxRow = { id: string; invoice_id: string | null; payer: string | null; reference: string | null; amount_vnd: number | null; status: string; origin: string | null };
  const allTx = rows.txs as Array<TxRow>;
  const isTestTx = (x: TxRow) => (x.invoice_id !== null && testInvoices.has(x.invoice_id)) || isTestRunName(x.payer, x.reference);
  type W = Pick<WorkItem, "id" | "lead_id" | "department" | "status" | "reason" | "decided_path" | "created_at" | "updated_at" | "completed_at">
    & { summary: string | null; contact: string | null; customer: string | null };
  const allWork = rows.work as Array<W>;
  const testWork = new Set(allWork.filter((x) => isTestLead(x.lead_id) || isTestRunName(x.summary, x.contact, x.customer)).map((x) => x.id));
  const isTestDecision = (d: { work_item_id: string | null; lead_id: string | null }) => isTestLead(d.lead_id) || (d.work_item_id !== null && testWork.has(d.work_item_id));

  const leads = allLeads.filter((x) => !testLeads.has(x.id));
  const o = allOrders.filter((x) => !testOrders.has(x.id));
  const i = allInvoices.filter((x) => !testInvoices.has(x.id));
  const tAll = allTx.filter((x) => !isTestTx(x));
  const evidenced = (x: TxRow) => x.status === "matched" && x.invoice_id !== null;
  const t = tAll.filter(evidenced);
  const unverified = tAll.filter((x) => !evidenced(x));
  const l = leads.filter((x) => x.created_at >= since7);
  const w = allWork.filter((x) => !testWork.has(x.id));
  const excludedTestRecords = testLeads.size + testOrders.size + testInvoices.size + (allTx.length - tAll.length) + testWork.size;

  type Money = { amount_vnd: number | null; origin: string | null };
  const sum = (rows: Array<Money>) => rows.reduce((s, r) => s + (r.amount_vnd ?? 0), 0);
  const all: Array<{ origin: string | null }> = [...o, ...i, ...t, ...l];

  const created7 = w.filter((x) => x.created_at >= since7);
  const d7 = (rows.decisions7 as Array<{ work_item_id: string | null; lead_id: string | null; decider_kind: string; outcome: string; created_at: string }>)
    .filter((d) => !isTestDecision(d));
  const byId = new Map(w.map((x) => [x.id, x]));
  const waits = d7.filter((d) => d.decider_kind !== "policy" && d.work_item_id && byId.has(d.work_item_id))
    .map((d) => (Date.parse(d.created_at) - Date.parse(byId.get(d.work_item_id!)!.created_at)) / 60_000);

  const exceptions: Record<ReasonCode | "failed", number> = { routine: 0, missing_data: 0, over_authority: 0, unclear_outcome: 0, not_allowed: 0, failed: 0 };
  for (const x of w) {
    if (x.status === "failed") exceptions.failed += 1;
    else if (x.status === "waiting_decision" && x.reason) exceptions[x.reason] += 1;
  }
  const waitingCount = w.filter((x) => x.status === "waiting_decision").length;

  // The stable modules always get a tile; any other module only once it has work.
  const departments = listModules().filter((m) => m.status === "stable" || w.some((x) => x.department === m.key)).map((m) => m.key).map((department) => {
    const mine = w.filter((x) => x.department === department);
    return {
      department,
      done7d: mine.filter((x) => x.status === "done" && (x.completed_at ?? "") >= since7).length,
      waiting: mine.filter((x) => x.status === "waiting_decision").length,
      lastActivityAt: mine.reduce<string | null>((m, x) => (!m || x.updated_at > m ? x.updated_at : m), null),
    };
  });

  const won = leads.filter((x) => x.stage === "won");
  const a = rows.auth;
  return {
    goals: { revenueVnd: a?.goal_revenue_vnd ?? null, newCustomers: a?.goal_new_customers ?? null, firstReplyMinutes: a?.goal_first_reply_minutes ?? null },
    results: {
      confirmedVnd: sum(o), invoicedVnd: sum(i), collectedVnd: sum(t), ordersConfirmed: o.length,
      newCustomers7d: l.length, wonCustomers: won.length,
      simulated: all.filter((x) => x.origin === "simulated").length, total: all.length,
    },
    status: {
      confirmedOrders: figure(o),
      internalInvoices: figure(i),
      matchedPayments: figure(t),
      pendingVerification: figure(unverified),
      newLeads7d: splitCount(l),
      wonLeads: splitCount(won),
      serviceCompleted: null,
      excludedTestRecords,
    },
    efficiency: {
      autoDone7d: d7.filter((d) => d.decider_kind === "policy" && d.outcome === "auto_done").length,
      askedHuman7d: created7.filter((x) => x.decided_path === "human" || x.status === "waiting_decision").length,
      medianDecisionMinutes: median(waits) === null ? null : Math.round(median(waits)!),
    },
    // Counted once: waiting work items (test runs excluded) + legacy pending approvals that have no work item.
    pendingDecisions: waitingCount + rows.pending_without_work,
    exceptions,
    departments,
    recentDecisions: (rows.recent as Array<DecisionDb>)
      .filter((d) => !isTestDecision(d) && !isTestRunName(d.lead?.contact_name)).slice(0, 5).map(toDecision),
  };
};

/** One customer's flow: work items in order, orders, invoices, payments and decisions. */
export const getLeadFlow = async (leadId: string): Promise<LeadFlow> => {
  const { db, ws } = await engineCtx();
  const [work, orders, invoices, decisions] = await Promise.all([
    db.from("work_items").select(WORK_SELECT).eq("workspace_id", ws).eq("lead_id", leadId).order("created_at"),
    db.from("orders").select("*").eq("workspace_id", ws).eq("lead_id", leadId).order("created_at"),
    db.from("invoices").select("*").eq("workspace_id", ws).eq("lead_id", leadId).order("created_at"),
    db.from("decisions").select("*, lead:leads(contact_name)").eq("workspace_id", ws).eq("lead_id", leadId).order("created_at"),
  ]);
  const inv = (invoices.data ?? []) as Array<Invoice>;
  const tx = inv.length
    ? (((await db.from("transactions").select("*").eq("workspace_id", ws).in("invoice_id", inv.map((x) => x.id)).order("created_at")).data ?? []) as Array<Transaction>)
    : [];
  return {
    workItems: ((work.data ?? []) as Array<WorkRow>).map(toView),
    orders: (orders.data ?? []) as Array<Order>,
    invoices: inv,
    transactions: tx,
    decisions: ((decisions.data ?? []) as Array<DecisionDb>).map(toDecision),
  };
};
