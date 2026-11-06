import type { CountsResult } from "@nivo-lite/agent-sdk/block"
import { ADJUSTMENT, INVOICE, ORDER, TRANSACTION, transactionOf } from "../../../rules/accounting/accounting.fixtures"
import { questionQueueOf } from "../../../rules/accounting/questions"
import type { QuestionLine } from "../../../rules/accounting/questions"
import { unmatchedQueueOf } from "../../../rules/accounting/decisions"
import { entryStatusOf } from "../../../rules/accounting/entry-status"
import { dueSoonOf } from "../../../rules/accounting/due-soon"
import { ledgerOf } from "../../../rules/accounting/ledger"
import { figuresOf } from "../../../rules/accounting/figures"
import { lineageOf } from "../../../rules/accounting/lineage"
import { closeVerdict, periodOf } from "../../../rules/accounting/period"
import { weeklyIncomeOf } from "../../../rules/accounting/weekly"
import { ACCOUNTING_SETTINGS_DEFAULTS } from "../../../rules/accounting/settings"
import type { ModuleFixtures } from "../../module-fixtures"
import type { BookEntryRecord } from "../../../rules/accounting/accounting.types"
import type { EntryRow } from "../accounting.types"
import type { CloseView } from "../reads/close-check.read"
import type { EntryDetail } from "../reads/entry.read"
import type { DueSoonView } from "../reads/due-soon.read"
import type { FiguresView } from "../reads/figures.read"
import type { LedgerView } from "../reads/ledger.read"
import type { WeeklyView } from "../reads/weekly.read"

/** The shop's "now" of the fixtures: 4 Nov 2026, 18:30 shop time. */
export const FIXTURE_NOW: Date = new Date("2026-11-04T11:30:00.000Z")

const matched = transactionOf({ status: "matched", orderId: ORDER.id })

/** The rows of the entries list. */
export const ENTRY_ROWS: ReadonlyArray<EntryRow> = [
    {
        id: "00000000-0000-4000-8000-0000000001a1",
        note: "NGUYEN VAN DINH / NIVO8F3K2 chuyen tien",
        entryDate: "2026-11-04",
        kind: "income",
        amountVnd: 5_000_000,
        status: entryStatusOf("income"),
        counterparty: "Nguy\u1ec5n V\u0103n \u0110\u1ecbnh",
    },
    {
        id: "00000000-0000-4000-8000-0000000001a2",
        note: "Lan / Gi\u1ea3m gi\u00e1 \u0111\u00e3 th\u1ecfa thu\u1eadn qua \u0111i\u1ec7n tho\u1ea1i",
        entryDate: "2026-11-02",
        kind: "adjustment",
        amountVnd: 1_800_000,
        status: entryStatusOf("adjustment"),
        counterparty: "Lan",
    },
    {
        id: "00000000-0000-4000-8000-0000000001a3",
        note: "INV-202611-0001 / Nguy\u1ec5n V\u0103n \u0110\u1ecbnh",
        entryDate: "2026-11-01",
        kind: "invoice",
        amountVnd: 2_000_000,
        status: entryStatusOf("invoice"),
        counterparty: "Nguy\u1ec5n V\u0103n \u0110\u1ecbnh",
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
export const WEEKLY_VIEW: WeeklyView = {
    periodKey: "this",
    fromDay: "2026-11-01",
    ...weeklyIncomeOf(
        ENTRY_ROWS.filter((row) => row.kind === "income"),
        "2026-11-01",
        "2026-12-01",
    ),
}

/** The income of a month with no entry. */
export const WEEKLY_NONE: WeeklyView = {
    periodKey: "this",
    fromDay: "2026-11-01",
    ...weeklyIncomeOf([], "2026-11-01", "2026-12-01"),
}

/** The payment nobody tied to an invoice. */
export const UNMATCHED_PAYMENT = {
    id: "00000000-0000-4000-8000-0000000001c1",
    amountVnd: 300_000,
    reference: "CK HOA SEN SPA",
    payer: "Hoa Sen Spa",
    occurredAt: "2026-11-04T02:12:00.000Z",
}

/** The questions the department asks the owner. */
export const QUESTIONS: ReadonlyArray<QuestionLine> = [
    {
        id: "00000000-0000-4000-8000-0000000001d1",
        text: "Kho\u1ea3n 3.500.000 ₫ t\u1eeb SePay thu\u1ed9c H\u0110-0139 hay H\u0110-0140?",
        source: "SePay · 04/11 09:12",
        askedAt: "2026-11-04T02:12:00.000Z",
    },
    {
        id: "00000000-0000-4000-8000-0000000001d2",
        text: "\u0110\u01a1n #1088 \u0111\u00e3 ch\u1ed1t nh\u01b0ng ch\u01b0a c\u00f3 s\u1ed1 ti\u1ec1n, xu\u1ea5t h\u00f3a \u0111\u01a1n theo m\u1ee9c n\u00e0o?",
        source: "\u0110\u01a1n #1088",
        askedAt: "2026-11-03T08:00:00.000Z",
    },
    {
        id: "00000000-0000-4000-8000-0000000001d3",
        text: "Phi\u1ebfu chi PC-0012 c\u00f3 t\u00ednh v\u00e0o chi ph\u00ed th\u00e1ng n\u00e0y kh\u00f4ng?",
        source: "PC-0012",
        askedAt: "2026-11-02T08:00:00.000Z",
    },
]

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

const cashEntry = (
    id: string,
    kind: "income" | "expense",
    entryDate: string,
    amountVnd: number,
    note: string,
): BookEntryRecord => ({
    id,
    version: "1",
    kind,
    sourceEntity: "payment.transaction",
    sourceId: id,
    entryDate,
    amountVnd,
    note,
    counterparty: null,
    status: entryStatusOf(kind),
})

/** The entries of this month that moved money, oldest first. */
export const CASH_ENTRIES: ReadonlyArray<BookEntryRecord> = [
    cashEntry(
        "00000000-0000-4000-8000-0000000001e1",
        "expense",
        "2026-11-02",
        1_280_000,
        "PC-0012 \u00b7 Mua kh\u0103n b\u00f4ng",
    ),
    cashEntry(
        "00000000-0000-4000-8000-0000000001e2",
        "income",
        "2026-11-03",
        1_950_000,
        "H\u0110-0141 \u00b7 Anh Khoa",
    ),
    cashEntry("00000000-0000-4000-8000-0000000001e3", "income", "2026-11-04", 3_500_000, "SePay \u00b7 CK HOA SEN SPA"),
]

/** The cash book of this month: 12,000,000 brought forward, three entries on three days. */
export const LEDGER_VIEW: LedgerView = {
    periodKey: "this",
    fromDay: "2026-11-01",
    toDay: "2026-12-01",
    ...ledgerOf(12_000_000, CASH_ENTRIES),
}

/** The cash book of a month with no entry that moved money: the balance stays where it was. */
export const LEDGER_NONE: LedgerView = {
    periodKey: "this",
    fromDay: "2026-11-01",
    toDay: "2026-12-01",
    ...ledgerOf(12_000_000, []),
}

/** The tax declarations that fall due within 30 days of 12 January 2027, where the fourth quarter's value added tax is near. */
export const DUE_SOON_VIEW: DueSoonView = {
    rows: dueSoonOf(new Date("2027-01-12T03:00:00.000Z"), ACCOUNTING_SETTINGS_DEFAULTS.vatPeriod),
}

/** Nothing falls due. */
export const DUE_SOON_NONE: DueSoonView = { rows: [] }

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
        "accounting.questions": { ready: questionQueueOf(QUESTIONS, 3), empty: questionQueueOf([], 0) },
        "accounting.entry": { ready: ENTRY_DETAIL, empty: null },
        "accounting.figures": { ready: FIGURES_VIEW, empty: FIGURES_NONE },
        "accounting.ledger": { ready: LEDGER_VIEW, empty: LEDGER_NONE },
        "accounting.due-soon": { ready: DUE_SOON_VIEW, empty: DUE_SOON_NONE },
        "accounting.settings": { ready: ACCOUNTING_SETTINGS_DEFAULTS, empty: null },
        "accounting.close-check": { ready: CLOSE_READY, waiting: CLOSE_WAITING },
    },
    actions: {
        "accounting.adjust": { ok: true, data: { id: "00000000-0000-4000-8000-0000000001a2" } },
        "accounting.save-settings": { ok: true },
        "accounting.answer-question": { ok: true },
        "accounting.resolve-unmatched-payment": { ok: true, data: { result: "other-income" } },
    },
}

/** The payment module has no screen: only the answer of its action, for the graph's dry runs. */
export const PAYMENT_FIXTURES: ModuleFixtures = {
    reads: {},
    actions: {
        "payment.settle": { ok: true, data: { result: "paid", orderId: "00000000-0000-4000-8000-0000000000b1" } },
    },
}
