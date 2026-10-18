import type { AccountingWaitingWorkRow as WorkItemView } from "@modules/domain/decisions"
import type { StaffRow as Staff } from "@modules/domain/staff"
import type { InvoiceAccountingRow as BookInvoice } from "@modules/domain/invoices"
import type { TransactionAccountingRow as BookTransaction } from "@modules/domain/transactions"
import type {
    AccountingAgeing,
    AccountingCredit,
    AccountingInvoice,
    AccountingInvoiceStatus,
    AccountingMatchState,
    AccountingOrder,
    AccountingPeriod,
    AccountingPeriodKey,
    AccountingQuestion,
    AccountingQuestionGroup,
    AccountingSourceKind,
    AccountingWaiting,
    AccountingWorkbenchData,
} from "./accounting.contracts"
import type { AccountingBook, BookOrder } from "./accounting-book.contracts"
import { buildLedger, customerOf, originOf, toMs } from "@modules/domain/ledger"
import { isTestRunName, isTestRunWorkItem } from "./test-run.policy"

/** The verified caller and records used to build the accounting workbench. */
export interface AccountingWorkbenchInput {
    /** The owned records for this workspace. */
    readonly book: AccountingBook
    /** The read-side clock time, ISO text. */
    readonly now: Date
    /** The waiting accounting work items. */
    readonly exceptions: ReadonlyArray<WorkItemView>
    /** The staff assignment choices. */
    readonly staff: ReadonlyArray<Staff>
    /** The verified caller display name. */
    readonly ownerName: string
    /** The verified caller workspace role. */
    readonly role: string
}
/** A money or count accumulator split by origin. */
interface MutableSplit {
    live: number
    simulated: number
}
/** A money and count accumulator. */
interface MutableMeasure {
    vnd: MutableSplit
    count: MutableSplit
}
/** Invoice measures accumulated within a reporting period. */
interface InvoiceMeasures {
    readonly income: MutableMeasure
    readonly receivable: MutableMeasure
}
/** The records kept after excluding test data. */
interface KeptRows<Row> {
    rows: ReadonlyArray<Row>
    excluded: number
}
/** A mutable weekly paid-income bar. */
interface MutableWeek {
    startIso: string
    live: number
    simulated: number
}

/* ------------------------------------------------------------------ time (Vietnam, UTC+7, no DST) */

const OFFSET = 7 * 3_600_000
const DAY = 86_400_000
/** Ageing bucket edges in days: 0-30, 31-60, over 60. */
const AGEING_FIRST_DAYS = 30
const AGEING_SECOND_DAYS = 60

/** Start of the Vietnamese calendar month `back` months before the one containing `now`. */
const monthStart = (now: Date, back: number): number => {
    const shifted = new Date(now.getTime() + OFFSET)
    return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() - back, 1) - OFFSET
}

/** Monday 00:00 (Vietnam) of the week containing `at`. */
const weekStart = (at: number): number => {
    const shifted = at + OFFSET
    const dow = new Date(shifted).getUTCDay()
    return Math.floor(shifted / DAY) * DAY - ((dow + 6) % 7) * DAY - OFFSET
}

const inRange = (iso: string | null, from: number, to: number): boolean => {
    const at = toMs(iso)
    return Number.isFinite(at) && at >= from && at < to
}

/* ------------------------------------------------------------------ narrowing of the text columns */

const INVOICE_STATUSES: ReadonlyArray<AccountingInvoiceStatus> = ["draft", "issued", "paid", "void"]
const invoiceStatusOf = (value: string): AccountingInvoiceStatus =>
    INVOICE_STATUSES.find((status) => status === value) ?? "draft"

/* ------------------------------------------------------------------ small helpers */

const emptySplit = (): MutableSplit => ({ live: 0, simulated: 0 })
const emptyMeasure = (): MutableMeasure => ({
    vnd: emptySplit(),
    count: emptySplit(),
})

const addTo = (measure: MutableMeasure, origin: string | null, vnd: number): void => {
    const key = originOf(origin)
    measure.vnd[key] += vnd
    measure.count[key] += 1
}

const sourceOf = (tx: BookTransaction): AccountingSourceKind => {
    const inbound = tx.inbound
    if (inbound === null) return "other"
    if (inbound.event_id?.startsWith("vietcombank:") === true) return "vietcombank"
    return inbound.channel === "manual" ? "manual" : "inbox"
}

/** What the question is about, in the owner's words. */
const groupOf = (item: WorkItemView): AccountingQuestionGroup => {
    if (item.action === "reconcile_payment") return "unclear_payment"
    if (item.reason === "over_authority") return "over_limit"
    if (item.reason === "missing_data" || item.missing_fields.length > 0) return "missing_data"
    return "other"
}

/** Whether a bank credit needs a person to look at it. */
const isUnclear = (tx: BookTransaction, waitingTxIds: ReadonlySet<string | null>): boolean =>
    tx.status === "needs_review" || waitingTxIds.has(tx.id) || (tx.status === "matched" && tx.invoice_id === null)

const matchOf = (tx: BookTransaction, waitingTxIds: ReadonlySet<string | null>): AccountingMatchState => {
    if (tx.status === "matched" && tx.invoice_id !== null) return "matched"
    return isUnclear(tx, waitingTxIds) ? "unclear" : "unmatched"
}

/** Keeps the rows that are not test runs and reports how many were left out. */
const withoutTests = <Row>(rows: ReadonlyArray<Row>, isTest: (row: Row) => boolean): KeptRows<Row> => {
    const kept = rows.filter((row) => !isTest(row))
    return { rows: kept, excluded: rows.length - kept.length }
}

/* ------------------------------------------------------------------ periods, ageing, waiting */

/** Counts paid income and issued receivables within one period, keeping income in its existing week bar. */
const invoiceMeasuresOf = (
    invoices: ReadonlyArray<BookInvoice>,
    from: number,
    to: number,
    bars: Map<number, MutableWeek>,
): InvoiceMeasures => {
    const income = emptyMeasure()
    const receivable = emptyMeasure()
    for (const invoice of invoices) {
        if (invoice.status === "paid") {
            const at = invoice.paid_at ?? invoice.issued_at ?? invoice.created_at
            if (!inRange(at, from, to)) continue
            addTo(income, invoice.origin, invoice.amount_vnd)
            const bar = bars.get(weekStart(toMs(at)))
            if (bar !== undefined) bar[originOf(invoice.origin)] += invoice.amount_vnd
        } else if (invoice.status === "issued" && inRange(invoice.issued_at ?? invoice.created_at, from, to)) {
            addTo(receivable, invoice.origin, invoice.amount_vnd)
        }
    }
    return { income, receivable }
}

const buildPeriod = (
    key: AccountingPeriodKey,
    now: Date,
    invoices: ReadonlyArray<BookInvoice>,
    transactions: ReadonlyArray<BookTransaction>,
): AccountingPeriod => {
    const from = monthStart(now, key === "this" ? 0 : 1)
    const to = monthStart(now, key === "this" ? -1 : 0)
    const unmatched = emptyMeasure()
    const bars = new Map<number, MutableWeek>()
    for (let week = weekStart(from); week < to; week += 7 * DAY) {
        bars.set(week, { startIso: new Date(week).toISOString(), live: 0, simulated: 0 })
    }
    const { income, receivable } = invoiceMeasuresOf(invoices, from, to, bars)
    for (const tx of transactions) {
        if (!inRange(tx.occurred_at, from, to)) continue
        if (tx.status === "matched" && tx.invoice_id !== null) continue
        addTo(unmatched, tx.origin, tx.amount_vnd)
    }
    return {
        key,
        fromIso: new Date(from).toISOString(),
        toIso: new Date(to).toISOString(),
        income,
        receivable,
        unmatched,
        weeks: [...bars.values()],
    }
}

/** The ageing bucket an open invoice of this many days falls into. */
const slotOf = (days: number): keyof AccountingAgeing => {
    if (days > AGEING_SECOND_DAYS) return "d60"
    return days > AGEING_FIRST_DAYS ? "d30" : "d0"
}

/** Every open invoice by how old it is (all open invoices, whatever the period). */
const buildAgeing = (now: Date, invoices: ReadonlyArray<BookInvoice>): AccountingAgeing => {
    const ageing = { d0: emptyMeasure(), d30: emptyMeasure(), d60: emptyMeasure() }
    for (const invoice of invoices) {
        if (invoice.status !== "issued") continue
        const since = toMs(invoice.due_at ?? invoice.issued_at ?? invoice.created_at)
        const days = Number.isFinite(since) ? Math.floor((now.getTime() - since) / DAY) : 0
        addTo(ageing[slotOf(days)], invoice.origin, invoice.amount_vnd)
    }
    return ageing
}

/** The waiting accounting items by origin, with the money they already carry. */
const buildWaiting = (items: ReadonlyArray<WorkItemView>): AccountingWaiting => {
    const count = emptySplit()
    let knownVnd = 0
    let unknownAmount = 0
    for (const item of items) {
        count[originOf(item.origin)] += 1
        const amount = item.proposal.amount_vnd
        if (typeof amount === "number") knownVnd += amount
        else unknownAmount += 1
    }
    return { count, knownVnd, unknownAmount }
}

/* ------------------------------------------------------------------ the workbench */

const toCredit = (
    tx: BookTransaction,
    invoiceNoOf: (invoiceId: string) => string | null,
    waitingTxIds: ReadonlySet<string | null>,
): AccountingCredit => ({
    id: tx.id,
    occurredAt: tx.occurred_at,
    amount: Number(tx.amount_vnd),
    payer: tx.payer,
    reference: tx.reference,
    origin: originOf(tx.origin),
    match: matchOf(tx, waitingTxIds),
    invoiceNo: tx.invoice_id === null ? null : invoiceNoOf(tx.invoice_id),
    sourceKind: sourceOf(tx),
})

const toInvoice = (invoice: BookInvoice): AccountingInvoice => ({
    id: invoice.id,
    invoiceNo: invoice.invoice_no,
    amount: Number(invoice.amount_vnd),
    status: invoiceStatusOf(invoice.status),
    origin: originOf(invoice.origin),
    customer: customerOf(invoice.lead),
    issuedAt: invoice.issued_at,
    paidAt: invoice.paid_at,
    dueAt: invoice.due_at,
    createdAt: invoice.created_at,
    orderNo: invoice.order?.order_no ?? null,
})

const toOrder = (order: BookOrder): AccountingOrder => ({
    id: order.id,
    orderNo: order.order_no,
    items: order.items,
    amount: order.amount_vnd === null ? null : Number(order.amount_vnd),
    origin: originOf(order.origin),
    customer: customerOf(order.lead),
    createdAt: order.created_at,
})

/** Builds the Accounting workbench from the raw book and the waiting work. */
export const buildAccountingWorkbench = (input: AccountingWorkbenchInput): AccountingWorkbenchData => {
    const { book, now } = input
    const invoicesKept = withoutTests(book.invoices, (invoice) =>
        isTestRunName(invoice.invoice_no, customerOf(invoice.lead), invoice.order?.items),
    )
    const txsKept = withoutTests(book.transactions, (tx) =>
        isTestRunName(tx.payer, tx.reference, tx.inbound?.sender_name),
    )
    const ordersKept = withoutTests(book.orders, (order) =>
        isTestRunName(order.order_no, order.items, customerOf(order.lead)),
    )
    const invoices = invoicesKept.rows
    const transactions = txsKept.rows

    /* questions: waiting accounting work (the existing decide UI renders them) */
    const waitingItems = input.exceptions.filter(
        (item) => item.department === "accounting" && item.status === "waiting_decision" && !isTestRunWorkItem(item),
    )
    const questions: ReadonlyArray<AccountingQuestion> = waitingItems.map((item) => ({ item, group: groupOf(item) }))
    const waitingTxIds = new Set(
        waitingItems.filter((item) => item.subject_type === "transaction").map((item) => item.subject_id),
    )

    /* evidence */
    const invoiceNos = new Map(invoices.map((invoice) => [invoice.id, invoice.invoice_no]))
    const invoicedOrders = new Set(
        invoices.map((invoice) => invoice.order_id).filter((id): id is string => id !== null),
    )

    return {
        now: now.toISOString(),
        periods: {
            this: buildPeriod("this", now, invoices, transactions),
            last: buildPeriod("last", now, invoices, transactions),
        },
        ageing: buildAgeing(now, invoices),
        waiting: buildWaiting(waitingItems),
        credits: transactions
            .slice(0, 200)
            .map((tx) => toCredit(tx, (invoiceId) => invoiceNos.get(invoiceId) ?? null, waitingTxIds)),
        invoices: invoices.slice(0, 200).map(toInvoice),
        ordersWithoutInvoice: ordersKept.rows
            .filter((order) => order.status !== "cancelled" && !invoicedOrders.has(order.id))
            .map(toOrder),
        questions,
        staff: input.staff,
        ownerName: input.ownerName,
        ledger: buildLedger({
            invoices,
            transactions,
            works: book.works,
            decisions: book.decisions,
            adjustments: book.adjustments,
        }),
        canAdjust: book.adjustmentsReady && (input.role === "owner" || input.role === "manager"),
        adjustmentsReady: book.adjustmentsReady,
        excludedTest: invoicesKept.excluded + txsKept.excluded + ordersKept.excluded,
    }
}
