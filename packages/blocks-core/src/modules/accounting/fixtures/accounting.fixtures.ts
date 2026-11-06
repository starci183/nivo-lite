import type { CountsResult } from "@nivo-lite/agent-sdk/block"
import { ADJUSTMENT, INVOICE, ORDER, TRANSACTION, transactionOf } from "../../../rules/accounting/accounting.fixtures"
import { unmatchedQueueOf } from "../../../rules/accounting/decisions"
import { entryStatusOf } from "../../../rules/accounting/entry-status"
import { figuresOf } from "../../../rules/accounting/figures"
import { lineageOf } from "../../../rules/accounting/lineage"
import { closeVerdict, periodOf } from "../../../rules/accounting/period"
import { weeklyIncomeOf } from "../../../rules/accounting/weekly"
import type { WeeklyIncome } from "../../../rules/accounting/weekly"
import { ACCOUNTING_SETTINGS_DEFAULTS } from "../../../rules/accounting/settings"
import type { ModuleFixtures } from "../../module-fixtures"
import type { EntryRow } from "../accounting.types"
import type { CloseView } from "../reads/close-check.read"
import type { EntryDetail } from "../reads/entry.read"
import type { FiguresView } from "../reads/figures.read"

/** The shop's "now" of the fixtures: 4 Nov 2026, 18:30 shop time. */
export const FIXTURE_NOW: Date = new Date("2026-11-04T11:30:00.000Z")

const matched = transactionOf({ status: "matched", orderId: ORDER.id })

/** The rows of the entries list. */
export const ENTRY_ROWS: ReadonlyArray<EntryRow> = [
    {
        id: "00000000-0000-4000-8000-0000000001a1",
        title: "NGUYEN VAN DINH / NIVO8F3K2 chuyen tien",
        entryDate: "2026-11-04",
        kind: "income",
        amountVnd: 5_000_000,
        status: entryStatusOf("income"),
    },
    {
        id: "00000000-0000-4000-8000-0000000001a2",
        title: "Lan / Gi\u1ea3m gi\u00e1 \u0111\u00e3 th\u1ecfa thu\u1eadn qua \u0111i\u1ec7n tho\u1ea1i",
        entryDate: "2026-11-02",
        kind: "adjustment",
        amountVnd: 1_800_000,
        status: entryStatusOf("adjustment"),
    },
    {
        id: "00000000-0000-4000-8000-0000000001a3",
        title: "INV-202611-0001 / Nguy\u1ec5n V\u0103n \u0110\u1ecbnh",
        entryDate: "2026-11-01",
        kind: "invoice",
        amountVnd: 2_000_000,
        status: entryStatusOf("invoice"),
    },
]

/** The counts of the entries by kind, as the counts read yields them. */
export const ENTRY_COUNTS: CountsResult = { counts: { income: 1, invoice: 1, adjustment: 1 }, total: 3 }

/** The counts under a search that matched nothing. */
export const ENTRY_COUNTS_NONE: CountsResult = { counts: { income: 0, invoice: 0, adjustment: 0 }, total: 0 }

/** The counts of the entries by status, as the status counts read yields them. */
export const ENTRY_STATUS_COUNTS: CountsResult = { counts: { paid: 1, open: 1, expense: 0, review: 1 }, total: 3 }

/** The status counts under a search that matched nothing. */
export const ENTRY_STATUS_COUNTS_NONE: CountsResult = {
    counts: { paid: 0, open: 0, expense: 0, review: 0 },
    total: 0,
}

/** The income of this month by week. */
export const WEEKLY_VIEW: WeeklyIncome = weeklyIncomeOf(
    ENTRY_ROWS.filter((row) => row.kind === "income"),
    "2026-11-01",
    "2026-12-01",
)

/** The income of a month with no entry. */
export const WEEKLY_NONE: WeeklyIncome = weeklyIncomeOf([], "2026-11-01", "2026-12-01")

/** The payment nobody tied to an invoice. */
export const UNMATCHED_PAYMENT = {
    id: "00000000-0000-4000-8000-0000000001c1",
    amountVnd: 300_000,
    reference: "CK HOA SEN SPA",
    payer: "Hoa Sen Spa",
    occurredAt: "2026-11-04T02:12:00.000Z",
}

/** The detail of the income entry: the payment, the order it paid and the correction on it. */
export const ENTRY_DETAIL: EntryDetail = {
    id: "00000000-0000-4000-8000-0000000001a1",
    kind: "income",
    entryDate: "2026-11-04",
    amountVnd: 5_000_000,
    note: "NGUYEN VAN DINH / NIVO8F3K2 chuyen tien",
    sourceEntity: "payment.transaction",
    sourceId: TRANSACTION.id,
    lineage: lineageOf({
        order: ORDER,
        invoice: null,
        transaction: matched,
        adjustments: [{ ...ADJUSTMENT, targetType: "transaction", targetId: TRANSACTION.id }],
    }),
    adjustmentCount: 1,
}

/** The figures of this month: 5,000,000 received, one invoice of 2,000,000 still open, one payment nobody tied to anything. */
export const FIGURES_VIEW: FiguresView = {
    periodKey: "this",
    fromDay: "2026-11-01",
    toDay: "2026-12-01",
    ...figuresOf({
        totals: [
            { kind: "income", vnd: 5_000_000, count: 1 },
            { kind: "invoice", vnd: 2_000_000, count: 1 },
            { kind: "adjustment", vnd: 1_800_000, count: 1 },
        ],
        unmatched: { vnd: 300_000, count: 1 },
        openInvoices: [
            {
                amountVnd: INVOICE.amountVnd,
                dueAt: INVOICE.dueAt,
                issuedAt: INVOICE.issuedAt,
                createdAt: INVOICE.createdAt,
            },
        ],
        now: FIXTURE_NOW,
    }),
}

const lastPeriod = periodOf(FIXTURE_NOW, "last")

/** Last month cannot close: a payment is unmatched and a question waits for the owner. */
export const CLOSE_BLOCKED: CloseView = {
    periodKey: "last",
    fromDay: lastPeriod.fromDay,
    toDay: lastPeriod.toDay,
    ...closeVerdict({ period: lastPeriod, now: FIXTURE_NOW, unmatchedPayments: 1, waitingQuestions: 2 }),
}

/** Last month waits only for the owner's answer. */
export const CLOSE_WAITING: CloseView = {
    periodKey: "last",
    fromDay: lastPeriod.fromDay,
    toDay: lastPeriod.toDay,
    ...closeVerdict({ period: lastPeriod, now: FIXTURE_NOW, unmatchedPayments: 0, waitingQuestions: 2 }),
}

/** Last month may close. */
export const CLOSE_READY: CloseView = {
    periodKey: "last",
    fromDay: lastPeriod.fromDay,
    toDay: lastPeriod.toDay,
    ...closeVerdict({ period: lastPeriod, now: FIXTURE_NOW, unmatchedPayments: 0, waitingQuestions: 0 }),
}

const NONE = { vnd: 0, count: 0 }

/** The figures of a month with no entry at all. */
export const FIGURES_NONE: FiguresView = {
    periodKey: "this",
    fromDay: "2026-11-01",
    toDay: "2026-12-01",
    ...figuresOf({ totals: [], unmatched: NONE, openInvoices: [], now: FIXTURE_NOW }),
}

/**
 * The Accounting reads in the states a prototype draws (ready, empty, and the period that waits for the owner's answer) and the
 * answer of its action. Built from the same sample records the rules' specs use, through the module's own rules. Loading and error
 * need no data.
 */
export const ACCOUNTING_FIXTURES: ModuleFixtures = {
    reads: {
        "accounting.entries": {
            ready: { rows: ENTRY_ROWS, cursor: null },
            empty: { rows: [], cursor: null },
        },
        "accounting.entry-counts": { ready: ENTRY_COUNTS, empty: ENTRY_COUNTS_NONE },
        "accounting.status-counts": { ready: ENTRY_STATUS_COUNTS, empty: ENTRY_STATUS_COUNTS_NONE },
        "accounting.weekly": { ready: WEEKLY_VIEW, empty: WEEKLY_NONE },
        "accounting.decisions": { ready: unmatchedQueueOf([UNMATCHED_PAYMENT], 1), empty: unmatchedQueueOf([], 0) },
        "accounting.question-count": { ready: { count: 3 }, empty: { count: 0 } },
        "accounting.questions": {
            ready: { count: "3", rows: [], linkLabel: "", linkHref: "", more: null },
            empty: { count: null, rows: [], linkLabel: "", linkHref: "", more: null },
        },
        "accounting.entry": { ready: ENTRY_DETAIL, empty: null },
        "accounting.figures": { ready: FIGURES_VIEW, empty: FIGURES_NONE },
        "accounting.settings": { ready: ACCOUNTING_SETTINGS_DEFAULTS, empty: null },
        "accounting.close-check": { ready: CLOSE_READY, waiting: CLOSE_WAITING },
    },
    actions: {
        "accounting.adjust": { ok: true, data: { id: "00000000-0000-4000-8000-0000000001a2" } },
        "accounting.save-settings": { ok: true },
    },
}

/** The payment module has no screen: only the answer of its action, for the graph's dry runs. */
export const PAYMENT_FIXTURES: ModuleFixtures = {
    reads: {},
    actions: {
        "payment.settle": { ok: true, data: { result: "paid", orderId: "00000000-0000-4000-8000-0000000000b1" } },
    },
}
