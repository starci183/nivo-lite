import "server-only";
import { engineCtx } from "./flow-ctx";
import { isTestRunName, isTestRunWorkItem, listExceptions, listStaff } from "./flow-queries";
import type { Invoice, Order, Origin, Staff, Transaction, WorkItemView } from "./flow-types";

/**
 * Accounting workbench data (read side). Everything is derived from the records the flow already keeps:
 * invoices (internal payment records), transactions (bank credits), orders, accounting work items and decisions.
 * `sepay_transactions` is workspace billing, not customer money, and is never read here.
 * Test runs (UAT / DBG, see TEST_RUN_PATTERN) are left out of every figure and counted in `excludedTest`.
 */

/* ------------------------------------------------------------------ types (plain data, safe for client components) */

export type OriginSplit = { live: number; simulated: number };
/** One figure: money and record count, each split by where the records came from. Never merged into one number. */
export type Measure = { vnd: OriginSplit; count: OriginSplit };
export type WeekBar = { startIso: string; live: number; simulated: number };
export type PeriodKey = "this" | "last";
export type PeriodOverview = {
  key: PeriodKey;
  fromIso: string;
  toIso: string;
  /** Paid invoices (internal payment records) whose payment date falls in the period. */
  income: Measure;
  /** Invoices issued in the period that are still unpaid. */
  receivable: Measure;
  /** Money in (bank credits, manual) received in the period that is not tied to an invoice yet. */
  unmatched: Measure;
  weeks: WeekBar[];
};
export type WaitingFigure = { count: OriginSplit; knownVnd: number; unknownAmount: number };

export type MatchState = "matched" | "unclear" | "unmatched";
export type CreditRow = {
  id: string; occurredAt: string; amount: number; payer: string | null; reference: string | null; origin: Origin;
  match: MatchState; invoiceNo: string | null; sourceKind: "vietcombank" | "inbox" | "manual" | "other"; sourceNote: string | null;
};
export type InvoiceRow = {
  id: string; invoiceNo: string; amount: number; status: Invoice["status"]; origin: Origin; customer: string | null;
  issuedAt: string | null; paidAt: string | null; dueAt: string | null; createdAt: string; orderNo: string | null;
};
export type OrderRow = { id: string; orderNo: string; items: string; amount: number | null; status: Order["status"]; origin: Origin; customer: string | null; createdAt: string };

export type LineageStep = {
  kind: "order" | "invoice" | "payment" | "decision" | "adjustment";
  title: string; detail: string | null; at: string | null; status: string | null; amount: number | null;
};
export type LedgerKind = "income" | "receivable";
export type LedgerStatus = "issued" | "paid" | "void" | "settled" | "matched" | "unmatched" | "needs_review";
export type LedgerEntry = {
  /** "inv:<id>" or "tx:<id>" */
  id: string;
  targetType: "invoice" | "transaction";
  targetId: string;
  at: string;
  description: string;
  kind: LedgerKind;
  amount: number;
  status: LedgerStatus;
  linked: string | null;
  origin: Origin;
  lineage: LineageStep[];
  adjustmentCount: number;
};

export type QuestionGroup = "unclear_payment" | "over_limit" | "missing_data" | "other";
export type QuestionRow = { item: WorkItemView; group: QuestionGroup };

export type AccountingWorkbench = {
  now: string;
  periods: Record<PeriodKey, PeriodOverview>;
  waiting: WaitingFigure;
  credits: CreditRow[];
  invoices: InvoiceRow[];
  ordersWithoutInvoice: OrderRow[];
  questions: QuestionRow[];
  staff: Staff[];
  ownerName: string;
  ledger: LedgerEntry[];
  canAdjust: boolean;
  /** False until the accounting_adjustments migration is applied: the correction form is then withheld. */
  adjustmentsReady: boolean;
  excludedTest: number;
};

/* ------------------------------------------------------------------ time (Vietnam, UTC+7, no DST) */

const OFFSET = 7 * 3_600_000;
const DAY = 86_400_000;

/** Start of the Vietnamese calendar month `back` months before the one containing `now`. */
const monthStart = (now: Date, back: number): number => {
  const s = new Date(now.getTime() + OFFSET);
  return Date.UTC(s.getUTCFullYear(), s.getUTCMonth() - back, 1) - OFFSET;
};

/** Monday 00:00 (Vietnam) of the week containing `ms`. */
const weekStart = (ms: number): number => {
  const shifted = ms + OFFSET;
  const dow = new Date(shifted).getUTCDay();
  return Math.floor(shifted / DAY) * DAY - ((dow + 6) % 7) * DAY - OFFSET;
};

/* ------------------------------------------------------------------ small helpers */

const emptySplit = (): OriginSplit => ({ live: 0, simulated: 0 });
const emptyMeasure = (): Measure => ({ vnd: emptySplit(), count: emptySplit() });
const originOf = (o: string | null | undefined): keyof OriginSplit => (o === "simulated" ? "simulated" : "live");
const addTo = (m: Measure, origin: string | null | undefined, vnd: number) => {
  const k = originOf(origin);
  m.vnd[k] += vnd;
  m.count[k] += 1;
};
const one = <R,>(v: R | Array<R> | null | undefined): R | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const ms = (iso: string | null | undefined): number => (iso ? new Date(iso).getTime() : Number.NaN);
const inRange = (iso: string | null | undefined, from: number, to: number): boolean => {
  const t = ms(iso);
  return Number.isFinite(t) && t >= from && t < to;
};

type Lead = { contact_name: string | null; company: string | null } | null;
type InvoiceDb = Invoice & { order: Pick<Order, "order_no" | "items" | "amount_vnd" | "status"> | Array<Pick<Order, "order_no" | "items" | "amount_vnd" | "status">> | null; lead: Lead | Array<NonNullable<Lead>> };
type TxDb = Transaction & { inbound: { channel: string; event_id: string | null; body: string; sender_name: string | null } | Array<{ channel: string; event_id: string | null; body: string; sender_name: string | null }> | null };
type OrderDb = Order & { lead: Lead | Array<NonNullable<Lead>> };
type WorkLite = { id: string; action: string; status: string; subject_type: string; subject_id: string | null; created_at: string };
type DecisionLite = { id: string; work_item_id: string | null; action: string; decided_by: string; decider_kind: string; outcome: string; note: string | null; created_at: string };
type AdjustmentDb = { id: string; target_type: "invoice" | "transaction"; target_id: string; note: string; corrected_amount_vnd: number | null; created_by: string; created_at: string };

const customerOf = (lead: Lead | Array<NonNullable<Lead>>): string | null => {
  const l = one<NonNullable<Lead>>(lead as NonNullable<Lead> | Array<NonNullable<Lead>> | null);
  return l ? (l.contact_name || l.company || null) : null;
};

const sourceOf = (tx: TxDb): Pick<CreditRow, "sourceKind" | "sourceNote"> => {
  const inb = one(tx.inbound);
  if (inb?.event_id?.startsWith("vietcombank:")) return { sourceKind: "vietcombank", sourceNote: inb.event_id.slice("vietcombank:".length) };
  if (inb?.channel === "manual") return { sourceKind: "manual", sourceNote: inb.body || null };
  if (inb) return { sourceKind: "inbox", sourceNote: inb.channel };
  return { sourceKind: "other", sourceNote: null };
};

/** What the question is about, in the owner's words (see FLOW-PLAN §accounting). */
const groupOf = (item: WorkItemView): QuestionGroup => {
  if (item.action === "reconcile_payment") return "unclear_payment";
  if (item.reason === "over_authority") return "over_limit";
  if (item.reason === "missing_data" || item.missing_fields.length > 0) return "missing_data";
  return "other";
};

/* ------------------------------------------------------------------ loader */

/** The whole accounting workbench for the signed-in workspace. Throws only when the core tables cannot be read. */
export const getAccountingWorkbench = async (): Promise<AccountingWorkbench> => {
  const c = await engineCtx();
  const { db, ws } = c;
  const now = new Date();

  const [invRes, txRes, ordRes, workRes, decRes, adjRes, exceptions, staff] = await Promise.all([
    db.from("invoices").select("*, order:orders(order_no, items, amount_vnd, status), lead:leads(contact_name, company)").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(1000),
    db.from("transactions").select("*, inbound:inbound_events(channel, event_id, body, sender_name)").eq("workspace_id", ws).order("occurred_at", { ascending: false }).limit(1000),
    db.from("orders").select("*, lead:leads(contact_name, company)").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(500),
    db.from("work_items").select("id, action, status, subject_type, subject_id, created_at").eq("workspace_id", ws).eq("department", "accounting").order("created_at", { ascending: false }).limit(500),
    db.from("decisions").select("id, work_item_id, action, decided_by, decider_kind, outcome, note, created_at").eq("workspace_id", ws).eq("department", "accounting").order("created_at", { ascending: false }).limit(500),
    db.from("accounting_adjustments").select("id, target_type, target_id, note, corrected_amount_vnd, created_by, created_at").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(500),
    listExceptions().catch(() => [] as WorkItemView[]),
    listStaff().catch(() => [] as Staff[]),
  ]);
  if (invRes.error) throw new Error(invRes.error.message);
  if (txRes.error) throw new Error(txRes.error.message);

  let excludedTest = 0;
  const keep = <R,>(rows: R[] | null, isTest: (r: R) => boolean): R[] => {
    const all = rows ?? [];
    const kept = all.filter((r) => !isTest(r));
    excludedTest += all.length - kept.length;
    return kept;
  };

  const invoicesDb = keep((invRes.data ?? []) as InvoiceDb[], (i) => isTestRunName(i.invoice_no, customerOf(i.lead), one(i.order)?.items));
  const txsDb = keep((txRes.data ?? []) as TxDb[], (t) => isTestRunName(t.payer, t.reference, one(t.inbound)?.sender_name));
  const ordersDb = keep((ordRes.data ?? []) as OrderDb[], (o) => isTestRunName(o.order_no, o.items, customerOf(o.lead)));
  const works = (workRes.data ?? []) as WorkLite[];
  const decisions = (decRes.data ?? []) as DecisionLite[];
  const adjustmentsReady = !adjRes.error;
  const adjustments = adjustmentsReady ? ((adjRes.data ?? []) as AdjustmentDb[]) : [];

  /* ---- questions: waiting accounting work (the existing decide UI renders them) */
  const waitingItems = exceptions.filter((i) => i.department === "accounting" && i.status === "waiting_decision" && !isTestRunWorkItem(i));
  const questions: QuestionRow[] = waitingItems.map((item) => ({ item, group: groupOf(item) }));
  const waiting: WaitingFigure = { count: emptySplit(), knownVnd: 0, unknownAmount: 0 };
  for (const i of waitingItems) {
    waiting.count[originOf(i.origin)] += 1;
    const amount = typeof i.proposal.amount_vnd === "number" ? i.proposal.amount_vnd : null;
    if (amount === null) waiting.unknownAmount += 1;
    else waiting.knownVnd += amount;
  }
  const waitingTxIds = new Set(waitingItems.filter((i) => i.subject_type === "transaction" && i.subject_id).map((i) => i.subject_id as string));

  /* ---- indexes */
  const invById = new Map(invoicesDb.map((i) => [i.id, i]));
  const txByInvoice = new Map<string, TxDb[]>();
  for (const t of txsDb) if (t.invoice_id) txByInvoice.set(t.invoice_id, [...(txByInvoice.get(t.invoice_id) ?? []), t]);
  const invoicedOrders = new Set(invoicesDb.map((i) => i.order_id).filter((x): x is string => !!x));

  /* ---- overview per period */
  const buildPeriod = (key: PeriodKey): PeriodOverview => {
    const from = monthStart(now, key === "this" ? 0 : 1);
    const to = monthStart(now, key === "this" ? -1 : 0);
    const income = emptyMeasure();
    const receivable = emptyMeasure();
    const unmatched = emptyMeasure();
    const bars = new Map<number, WeekBar>();
    for (let w = weekStart(from); w < to; w += 7 * DAY) bars.set(w, { startIso: new Date(w).toISOString(), live: 0, simulated: 0 });
    for (const i of invoicesDb) {
      if (i.status === "paid") {
        const at = i.paid_at ?? i.issued_at ?? i.created_at;
        if (!inRange(at, from, to)) continue;
        addTo(income, i.origin, i.amount_vnd);
        const bar = bars.get(weekStart(ms(at)));
        if (bar) bar[originOf(i.origin)] += i.amount_vnd;
      } else if (i.status === "issued" && inRange(i.issued_at ?? i.created_at, from, to)) {
        addTo(receivable, i.origin, i.amount_vnd);
      }
    }
    for (const t of txsDb) {
      if (!inRange(t.occurred_at, from, to)) continue;
      if (t.status === "matched" && t.invoice_id) continue;
      addTo(unmatched, t.origin, t.amount_vnd);
    }
    return { key, fromIso: new Date(from).toISOString(), toIso: new Date(to).toISOString(), income, receivable, unmatched, weeks: [...bars.values()] };
  };

  /* ---- evidence */
  const credits: CreditRow[] = txsDb.slice(0, 200).map((t) => {
    const matched = t.status === "matched" && !!t.invoice_id;
    const match: MatchState = matched ? "matched" : t.status === "needs_review" || waitingTxIds.has(t.id) || (t.status === "matched" && !t.invoice_id) ? "unclear" : "unmatched";
    return {
      id: t.id, occurredAt: t.occurred_at, amount: Number(t.amount_vnd), payer: t.payer, reference: t.reference, origin: t.origin, match,
      invoiceNo: t.invoice_id ? (invById.get(t.invoice_id)?.invoice_no ?? null) : null, ...sourceOf(t),
    };
  });
  const invoices: InvoiceRow[] = invoicesDb.slice(0, 200).map((i) => ({
    id: i.id, invoiceNo: i.invoice_no, amount: Number(i.amount_vnd), status: i.status, origin: i.origin, customer: customerOf(i.lead),
    issuedAt: i.issued_at, paidAt: i.paid_at, dueAt: i.due_at, createdAt: i.created_at, orderNo: one(i.order)?.order_no ?? null,
  }));
  const ordersWithoutInvoice: OrderRow[] = ordersDb.filter((o) => o.status !== "cancelled" && !invoicedOrders.has(o.id)).map((o) => ({
    id: o.id, orderNo: o.order_no, items: o.items, amount: o.amount_vnd === null ? null : Number(o.amount_vnd), status: o.status, origin: o.origin,
    customer: customerOf(o.lead), createdAt: o.created_at,
  }));

  /* ---- ledger + lineage */
  const workBySubject = new Map<string, WorkLite[]>();
  for (const w of works) if (w.subject_id) workBySubject.set(w.subject_id, [...(workBySubject.get(w.subject_id) ?? []), w]);
  const decisionsByWork = new Map<string, DecisionLite[]>();
  for (const d of decisions) if (d.work_item_id) decisionsByWork.set(d.work_item_id, [...(decisionsByWork.get(d.work_item_id) ?? []), d]);
  const adjByTarget = new Map<string, AdjustmentDb[]>();
  for (const a of adjustments) adjByTarget.set(`${a.target_type}:${a.target_id}`, [...(adjByTarget.get(`${a.target_type}:${a.target_id}`) ?? []), a]);

  const decisionSteps = (subjectIds: Array<string | null | undefined>): LineageStep[] => {
    const seen = new Set<string>();
    const steps: LineageStep[] = [];
    for (const sid of subjectIds) {
      if (!sid) continue;
      for (const w of workBySubject.get(sid) ?? []) {
        for (const d of decisionsByWork.get(w.id) ?? []) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          steps.push({ kind: "decision", title: d.action, detail: [d.decider_kind === "policy" ? null : d.decided_by, d.note].filter(Boolean).join(" · ") || null, at: d.created_at, status: d.outcome, amount: null });
        }
      }
    }
    return steps;
  };
  const adjustmentSteps = (key: string): LineageStep[] =>
    (adjByTarget.get(key) ?? []).map((a) => ({ kind: "adjustment", title: a.created_by, detail: a.note, at: a.created_at, status: null, amount: a.corrected_amount_vnd }));
  const orderStep = (i: InvoiceDb): LineageStep | null => {
    const o = one(i.order);
    return o ? { kind: "order", title: o.order_no, detail: o.items || null, at: null, status: o.status, amount: o.amount_vnd === null ? null : Number(o.amount_vnd) } : null;
  };
  const invoiceStep = (i: InvoiceDb): LineageStep => ({ kind: "invoice", title: i.invoice_no, detail: customerOf(i.lead), at: i.issued_at ?? i.created_at, status: i.status, amount: Number(i.amount_vnd) });
  const paymentStep = (t: TxDb): LineageStep => ({ kind: "payment", title: t.payer || t.reference || "—", detail: t.reference, at: t.occurred_at, status: t.status, amount: Number(t.amount_vnd) });
  const sortSteps = (steps: Array<LineageStep | null>): LineageStep[] => {
    const real = steps.filter((s): s is LineageStep => s !== null);
    const rank = { order: 0, invoice: 1, payment: 2, decision: 3, adjustment: 4 } as const;
    return real.sort((a, b) => rank[a.kind] - rank[b.kind] || (ms(a.at) || 0) - (ms(b.at) || 0));
  };

  const ledger: LedgerEntry[] = [];
  for (const i of invoicesDb) {
    if (i.status === "draft") continue;
    const txs = txByInvoice.get(i.id) ?? [];
    const settledByPayment = i.status === "paid" && txs.length > 0;
    // A paid invoice with a matched bank credit is already counted as income by that credit's row; without one (a customer
    // claim confirmed by a person) the invoice row itself is the income entry, its basis is in the decision.
    const kind: LedgerKind = i.status === "paid" && !settledByPayment ? "income" : "receivable";
    ledger.push({
      id: `inv:${i.id}`, targetType: "invoice", targetId: i.id, at: (kind === "income" ? i.paid_at : null) ?? i.issued_at ?? i.created_at,
      description: [i.invoice_no, customerOf(i.lead)].filter(Boolean).join(" · "), kind, amount: Number(i.amount_vnd),
      status: settledByPayment ? "settled" : i.status === "void" ? "void" : i.status === "paid" ? "paid" : "issued",
      linked: one(i.order)?.order_no ?? null, origin: i.origin,
      lineage: sortSteps([orderStep(i), invoiceStep(i), ...txs.map(paymentStep), ...decisionSteps([i.id, i.order_id, ...txs.map((t) => t.id)]), ...adjustmentSteps(`invoice:${i.id}`)]),
      adjustmentCount: (adjByTarget.get(`invoice:${i.id}`) ?? []).length,
    });
  }
  for (const t of txsDb) {
    const inv = t.invoice_id ? invById.get(t.invoice_id) : undefined;
    ledger.push({
      id: `tx:${t.id}`, targetType: "transaction", targetId: t.id, at: t.occurred_at,
      description: [t.payer, t.reference].filter(Boolean).join(" · ") || "—", kind: "income", amount: Number(t.amount_vnd), status: t.status,
      linked: inv?.invoice_no ?? null, origin: t.origin,
      lineage: sortSteps([inv ? orderStep(inv) : null, inv ? invoiceStep(inv) : null, paymentStep(t), ...decisionSteps([t.id, inv?.id, inv?.order_id]), ...adjustmentSteps(`transaction:${t.id}`)]),
      adjustmentCount: (adjByTarget.get(`transaction:${t.id}`) ?? []).length,
    });
  }
  ledger.sort((a, b) => ms(b.at) - ms(a.at));

  return {
    now: now.toISOString(),
    periods: { this: buildPeriod("this"), last: buildPeriod("last") },
    waiting, credits, invoices, ordersWithoutInvoice, questions, staff, ownerName: c.session.member.displayName,
    ledger: ledger.slice(0, 400), canAdjust: adjustmentsReady && (c.session.member.role === "owner" || c.session.member.role === "manager"),
    adjustmentsReady, excludedTest,
  };
};
