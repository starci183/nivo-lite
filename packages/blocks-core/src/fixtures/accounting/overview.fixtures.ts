import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { accountingDueSoonBlock } from "../../blocks/accounting/due-soon.block"
import type { accountingLedgerBlock } from "../../blocks/accounting/ledger.block"
import type { accountingPeriodFiguresBlock } from "../../blocks/accounting/period-figures.block"
import type { BookEntryRecord } from "../../rules/accounting/accounting.types"
import type { Ledger } from "../../rules/accounting/ledger"
import { ledgerOf } from "../../rules/accounting/ledger"
import type { DueRecord, FiguresRecord } from "../../rules/accounting/overview-view"

/** The statuses a read is drawn in. */
type Status = "ready" | "empty" | "error" | "loading" | "forbidden"

/** The props of the period figures as the Accounting spec sets them. */
export const periodFiguresFixtureProps: z.infer<(typeof accountingPeriodFiguresBlock)["props"]> = {
    label: { vi: "Chỉ số chính", en: "Key figures" },
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
    title: { vi: "Sắp đến hạn", en: "Due soon" },
    horizon: { vi: "· 30 ngày tới", en: "· next 30 days" },
    empty: { vi: "Không có hạn thuế nào.", en: "No tax deadline." },
    notice: { vi: "Chỉ liệt kê hạn thuế.", en: "Only tax deadlines are listed." },
    linkLabel: { vi: "Mở Cài đặt", en: "Open Settings" },
    linkPath: "connections",
}

/** The two declarations of the canvas. */
export const DUE_READY: DueRecord = {
    rows: [
        { id: "vat-2026-11-20", kind: "vat", month: 10, dueDay: "2026-11-20", daysLeft: 15 },
        { id: "pit-2026-11-20", kind: "pit", month: 10, dueDay: "2026-11-20", daysLeft: 0 },
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
    title: { vi: "Sổ quỹ", en: "Cash book" },
    empty: { vi: "Chưa có khoản thu chi nào.", en: "No money in or out yet." },
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
