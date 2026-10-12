import type { Database } from "../../../../../../../supabase/types/database.types"
import type {
    AccountingLedgerEntry,
    AccountingLedgerKind,
    AccountingLedgerStatus,
    AccountingLineageStep,
    AccountingOrigin,
} from "@/modules/types"

type Tables = Database["public"]["Tables"]
type LeadName = Pick<Tables["leads"]["Row"], "contact_name" | "company">

/** An invoice with the order and lead it points at. */
export interface LedgerInvoice extends Pick<
    Tables["invoices"]["Row"],
    "id" | "invoice_no" | "status" | "amount_vnd" | "origin" | "order_id" | "paid_at" | "issued_at" | "created_at"
> {
    readonly order: Pick<Tables["orders"]["Row"], "order_no" | "items" | "amount_vnd" | "status"> | null
    readonly lead: LeadName | null
}

/** A bank credit. */
export type LedgerTransaction = Pick<
    Tables["transactions"]["Row"],
    "id" | "payer" | "reference" | "status" | "amount_vnd" | "origin" | "occurred_at" | "invoice_id"
>

/** An accounting work item, linked to its subject. */
export type LedgerWork = Pick<Tables["work_items"]["Row"], "id" | "subject_id">

/** A decision taken on a work item. */
export type LedgerDecision = Pick<
    Tables["decisions"]["Row"],
    "id" | "work_item_id" | "action" | "decided_by" | "decider_kind" | "outcome" | "note" | "created_at"
>

/** A correction recorded beside an invoice or a payment. */
export type LedgerAdjustment = Pick<
    Tables["accounting_adjustments"]["Row"],
    "target_type" | "target_id" | "note" | "corrected_amount_vnd" | "created_by" | "created_at"
>

/** The records a ledger is derived from. */
export interface LedgerInput {
    readonly invoices: ReadonlyArray<LedgerInvoice>
    readonly transactions: ReadonlyArray<LedgerTransaction>
    readonly works: ReadonlyArray<LedgerWork>
    readonly decisions: ReadonlyArray<LedgerDecision>
    readonly adjustments: ReadonlyArray<LedgerAdjustment>
}

const LEDGER_LIMIT = 400

/** Where a record came from; anything that is not marked simulated counts as live. */
export const originOf = (value: string | null): AccountingOrigin => (value === "simulated" ? "simulated" : "live")
/** An ISO instant as milliseconds, or NaN when there is none. */
export const toMs = (iso: string | null): number => (iso === null ? Number.NaN : new Date(iso).getTime())
/** The name the customer goes by, or null when the lead has none. */
export const customerOf = (lead: LeadName | null): string | null =>
    lead === null ? null : lead.contact_name || lead.company || null

const LEDGER_STATUSES: ReadonlyArray<AccountingLedgerStatus> = [
    "issued",
    "paid",
    "void",
    "settled",
    "matched",
    "unmatched",
    "needs_review",
]
const ledgerStatusOf = (value: string): AccountingLedgerStatus =>
    LEDGER_STATUSES.find((status) => status === value) ?? "unmatched"

/** The items of a keyed bucket, or an empty list. */
const bucket = <Item>(map: ReadonlyMap<string, ReadonlyArray<Item>>, key: string): ReadonlyArray<Item> =>
    map.get(key) ?? []

/** Groups items by a key into a map of lists, keeping the input order. */
const groupBy = <Item>(
    items: ReadonlyArray<Item>,
    keyOf: (item: Item) => string | null,
): ReadonlyMap<string, ReadonlyArray<Item>> => {
    const map = new Map<string, Array<Item>>()
    for (const item of items) {
        const key = keyOf(item)
        if (key === null) continue
        const list = map.get(key)
        if (list === undefined) map.set(key, [item])
        else list.push(item)
    }
    return map
}

const lineageRank: Readonly<Record<AccountingLineageStep["kind"], number>> = {
    order: 0,
    invoice: 1,
    payment: 2,
    decision: 3,
    adjustment: 4,
}

const sortSteps = (steps: ReadonlyArray<AccountingLineageStep | null>): ReadonlyArray<AccountingLineageStep> =>
    steps
        .filter((step): step is AccountingLineageStep => step !== null)
        .sort((a, b) => lineageRank[a.kind] - lineageRank[b.kind] || (toMs(a.at) || 0) - (toMs(b.at) || 0))

const orderStep = (invoice: LedgerInvoice): AccountingLineageStep | null =>
    invoice.order === null
        ? null
        : {
              kind: "order",
              title: invoice.order.order_no,
              detail: invoice.order.items || null,
              at: null,
              status: invoice.order.status,
              amount: invoice.order.amount_vnd === null ? null : Number(invoice.order.amount_vnd),
          }

const invoiceStep = (invoice: LedgerInvoice): AccountingLineageStep => ({
    kind: "invoice",
    title: invoice.invoice_no,
    detail: customerOf(invoice.lead),
    at: invoice.issued_at ?? invoice.created_at,
    status: invoice.status,
    amount: Number(invoice.amount_vnd),
})

const paymentStep = (tx: LedgerTransaction): AccountingLineageStep => ({
    kind: "payment",
    title: tx.payer || tx.reference || "-",
    detail: tx.reference,
    at: tx.occurred_at,
    status: tx.status,
    amount: Number(tx.amount_vnd),
})

/** What a settled, paid or open invoice is called on the ledger. */
const invoiceLedgerStatus = (invoice: LedgerInvoice, settledByPayment: boolean): AccountingLedgerStatus => {
    if (settledByPayment) return "settled"
    if (invoice.status === "void") return "void"
    return invoice.status === "paid" ? "paid" : "issued"
}

/** The ledger derived from invoices and payments, newest first, with the lineage of every line. */
export const buildLedger = (input: LedgerInput): ReadonlyArray<AccountingLedgerEntry> => {
    const invoiceById = new Map(input.invoices.map((invoice) => [invoice.id, invoice]))
    const txByInvoice = groupBy(input.transactions, (tx) => tx.invoice_id)
    const workBySubject = groupBy(input.works, (work) => work.subject_id)
    const decisionsByWork = groupBy(input.decisions, (decision) => decision.work_item_id)
    const adjustmentsByTarget = groupBy(
        input.adjustments,
        (adjustment) => `${adjustment.target_type}:${adjustment.target_id}`,
    )

    const decisionSteps = (subjectIds: ReadonlyArray<string | null>): ReadonlyArray<AccountingLineageStep> => {
        const seen = new Set<string>()
        const steps: Array<AccountingLineageStep> = []
        for (const subjectId of subjectIds) {
            if (subjectId === null) continue
            for (const work of bucket(workBySubject, subjectId)) {
                for (const decision of bucket(decisionsByWork, work.id)) {
                    if (seen.has(decision.id)) continue
                    seen.add(decision.id)
                    const who = decision.decider_kind === "policy" ? null : decision.decided_by
                    steps.push({
                        kind: "decision",
                        title: decision.action,
                        detail: [who, decision.note].filter(Boolean).join(" · ") || null,
                        at: decision.created_at,
                        status: decision.outcome,
                        amount: null,
                    })
                }
            }
        }
        return steps
    }
    const adjustmentSteps = (key: string): ReadonlyArray<AccountingLineageStep> =>
        bucket(adjustmentsByTarget, key).map((adjustment) => ({
            kind: "adjustment",
            title: adjustment.created_by,
            detail: adjustment.note,
            at: adjustment.created_at,
            status: null,
            amount: adjustment.corrected_amount_vnd,
        }))

    const ledger: Array<AccountingLedgerEntry> = []
    for (const invoice of input.invoices) {
        if (invoice.status === "draft") continue
        const txs = bucket(txByInvoice, invoice.id)
        const settledByPayment = invoice.status === "paid" && txs.length > 0
        // A paid invoice with a matched bank credit is already counted as income by that credit's row; without one (a customer
        // claim confirmed by a person) the invoice row itself is the income entry, its basis is in the decision.
        const kind: AccountingLedgerKind = invoice.status === "paid" && !settledByPayment ? "income" : "receivable"
        ledger.push({
            id: `inv:${invoice.id}`,
            targetType: "invoice",
            targetId: invoice.id,
            at: (kind === "income" ? invoice.paid_at : null) ?? invoice.issued_at ?? invoice.created_at,
            description: [invoice.invoice_no, customerOf(invoice.lead)].filter(Boolean).join(" · "),
            kind,
            amount: Number(invoice.amount_vnd),
            status: invoiceLedgerStatus(invoice, settledByPayment),
            linked: invoice.order?.order_no ?? null,
            origin: originOf(invoice.origin),
            lineage: sortSteps([
                orderStep(invoice),
                invoiceStep(invoice),
                ...txs.map(paymentStep),
                ...decisionSteps([invoice.id, invoice.order_id, ...txs.map((tx) => tx.id)]),
                ...adjustmentSteps(`invoice:${invoice.id}`),
            ]),
            adjustmentCount: bucket(adjustmentsByTarget, `invoice:${invoice.id}`).length,
        })
    }
    for (const tx of input.transactions) {
        const invoice = tx.invoice_id === null ? undefined : invoiceById.get(tx.invoice_id)
        ledger.push({
            id: `tx:${tx.id}`,
            targetType: "transaction",
            targetId: tx.id,
            at: tx.occurred_at,
            description: [tx.payer, tx.reference].filter(Boolean).join(" · ") || "-",
            kind: "income",
            amount: Number(tx.amount_vnd),
            status: ledgerStatusOf(tx.status),
            linked: invoice?.invoice_no ?? null,
            origin: originOf(tx.origin),
            lineage: sortSteps([
                invoice === undefined ? null : orderStep(invoice),
                invoice === undefined ? null : invoiceStep(invoice),
                paymentStep(tx),
                ...decisionSteps([tx.id, invoice?.id ?? null, invoice?.order_id ?? null]),
                ...adjustmentSteps(`transaction:${tx.id}`),
            ]),
            adjustmentCount: bucket(adjustmentsByTarget, `transaction:${tx.id}`).length,
        })
    }
    return ledger.sort((a, b) => toMs(b.at) - toMs(a.at)).slice(0, LEDGER_LIMIT)
}
