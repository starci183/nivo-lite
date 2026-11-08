import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { accountingDueSoonBlock } from "../../blocks/accounting/due-soon.block"
import type { accountingLedgerBlock } from "../../blocks/accounting/ledger.block"
import type { accountingAgeingBlock } from "../../blocks/accounting/ageing.block"
import type { accountingWeeklyBlock } from "../../blocks/accounting/weekly.block"
import type { accountingPeriodFiguresBlock } from "../../blocks/accounting/period-figures.block"
import type { BookEntryRecord } from "../../rules/accounting/accounting.types"
import { entryStatusOf } from "../../rules/accounting/entry-status"
import { type Ledger, ledgerOf } from "../../rules/accounting/ledger"
import type { DueRecord, FiguresRecord } from "../../rules/accounting/overview-view"
import type { WeeklyRecord } from "../../rules/accounting/weekly-view"

/** The statuses a read is drawn in. */
type Status = "ready" | "empty" | "error" | "loading" | "forbidden"

/** The props of the period figures as the Accounting spec sets them. */
export const periodFiguresFixtureProps: z.infer<(typeof accountingPeriodFiguresBlock)["props"]> = {
    label: { vi: "Ch\u1ec9 s\u1ed1 ch\u00ednh", en: "Key figures" },
}

/** The figures of the canvas. */
export const FIGURES_READY: FiguresRecord = {
    periodKey: "this",
    income: { vnd: 84_200_000, count: 11 },
    receivable: { vnd: 31_650_000, count: 6 },
    unmatched: { vnd: 4_950_000, count: 3 },
    ageing: { d0: { count: 4 }, d30: { count: 1 }, d60: { count: 1 } },
}

/** The figures read in every status. */
export const periodFiguresFixtures: Readonly<Record<Status, DataSlot<FiguresRecord>>> = {
    ready: { items: FIGURES_READY },
    empty: { isEmpty: true },
    error: { isError: true },
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
}

/** The props of the due-soon list as the Accounting spec sets them. */
export const dueSoonFixtureProps: z.infer<(typeof accountingDueSoonBlock)["props"]> = {
    title: { vi: "S\u1eafp \u0111\u1ebfn h\u1ea1n", en: "Due soon" },
    horizon: { vi: "\u00b7 30 ng\u00e0y t\u1edbi", en: "\u00b7 next 30 days" },
    empty: { vi: "Kh\u00f4ng c\u00f3 h\u1ea1n thu\u1ebf n\u00e0o.", en: "No tax deadline." },
    notice: { vi: "Ch\u1ec9 li\u1ec7t k\u00ea h\u1ea1n thu\u1ebf.", en: "Only tax deadlines are listed." },
    linkLabel: { vi: "M\u1edf C\u00e0i \u0111\u1eb7t", en: "Open Settings" },
    linkPath: "/connections",
}

/** The two declarations of the canvas. */
export const DUE_READY: DueRecord = {
    rows: [
        { id: "pit-2027-01-20", kind: "pit", unit: "month", period: 12, dueDay: "2027-01-20", daysLeft: 8 },
        { id: "vat-2027-01-31", kind: "vat", unit: "quarter", period: 4, dueDay: "2027-01-31", daysLeft: 19 },
    ],
}

/** The due-soon read in every status. */
export const dueSoonFixtures: Readonly<Record<Status, DataSlot<DueRecord>>> = {
    ready: { items: DUE_READY },
    empty: { isEmpty: true },
    error: { isError: true },
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
}

/** The props of the cash book as the Accounting spec sets them. */
export const ledgerFixtureProps: z.infer<(typeof accountingLedgerBlock)["props"]> = {
    title: { vi: "S\u1ed5 qu\u1ef9", en: "Cash book" },
    empty: { vi: "Ch\u01b0a c\u00f3 kho\u1ea3n thu chi n\u00e0o.", en: "No money in or out yet." },
    periodParam: "period",
}

const entry = (id: string, kind: "income" | "expense", entryDate: string, amountVnd: number): BookEntryRecord => ({
    id,
    version: "1",
    kind,
    sourceEntity: "payment.transaction",
    sourceId: id,
    entryDate,
    amountVnd,
    note: null,
    counterparty: null,
    status: entryStatusOf(kind),
})

/** The cash book of a month: 12,000,000 brought forward, an expense and two receipts. */
export const LEDGER_READY: Ledger = ledgerOf(12_000_000, [
    entry("l1", "expense", "2026-11-02", 1_280_000),
    entry("l2", "income", "2026-11-03", 1_950_000),
    entry("l3", "income", "2026-11-03", 3_500_000),
])

/** The cash book read in every status. */
export const ledgerFixtures: Readonly<Record<Status | "waiting", DataSlot<Ledger>>> = {
    ready: { items: LEDGER_READY },
    waiting: { items: ledgerOf(12_000_000, []) },
    empty: { isEmpty: true },
    error: { isError: true },
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
}

/** The props of the weekly chart as the Accounting spec sets them. */
export const weeklyFixtureProps: z.infer<(typeof accountingWeeklyBlock)["props"]> = {
    title: { vi: "Thu nh\u1eadp theo tu\u1ea7n", en: "Income by week" },
    caption: { vi: "H\u00f3a \u0111\u01a1n \u0111\u00e3 thu, gom theo tu\u1ea7n.", en: "Invoices collected by week." },
    empty: { vi: "Ch\u01b0a thu kho\u1ea3n n\u00e0o.", en: "Nothing collected." },
    periodParam: "period",
}

/** Four weeks of income in the month of the canvas. */
export const WEEKLY_READY: WeeklyRecord = {
    periodKey: "this",
    fromDay: "2026-11-01",
    w1: 18_200_000,
    w2: 31_000_000,
    w3: 12_500_000,
    w4: 22_500_000,
    w5: 0,
}

/** The weekly read in every status. */
export const weeklyFixtures: Readonly<Record<Status, DataSlot<WeeklyRecord>>> = {
    ready: { items: WEEKLY_READY },
    empty: { isEmpty: true },
    error: { isError: true },
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
}

/** The props of the ageing as the Accounting spec sets them. */
export const ageingFixtureProps: z.infer<(typeof accountingAgeingBlock)["props"]> = {
    title: { vi: "Tu\u1ed5i n\u1ee3 ph\u1ea3i thu", en: "Receivable ageing" },
    empty: { vi: "Ch\u01b0a c\u00f3 h\u00f3a \u0111\u01a1n m\u1edf.", en: "No open invoice." },
}
