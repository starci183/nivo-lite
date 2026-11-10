import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import { messageOf } from "../../messages/catalog"
import { amountTextOf } from "../sales/order-notice.policy"
import { TOOL } from "../../vocabulary/tool-ids"
import { closeReportOf } from "./close-report"
import type { CloseReportPorts } from "./close-report"

/** A credit as the books keep it. */
interface CreditRead {
    readonly amountVnd: number
    readonly occurredAt: string
    readonly orderId: string | null
    readonly status: string
    readonly externalRef: string | null
}

type Store = Readonly<Record<string, ReadonlyArray<Readonly<Record<string, unknown>>>>>

/** The books from a store (equality filters, the limit) and the bank answering in order; a bank with no answer left cannot be read. */
const portsOf = (store: Store, answers: ReadonlyArray<unknown> = []): CloseReportPorts => {
    const left = [...answers]
    return {
        data: {
            read: <T>(kind: string, query: NodeQuery): Promise<ReadonlyArray<T>> => {
                const rows = (store[kind] ?? []).filter((row) =>
                    Object.entries(query.where ?? {}).every(([field, value]) => row[field] === value),
                )
                return Promise.resolve(rows.slice(0, query.limit ?? rows.length) as ReadonlyArray<T>)
            },
        },
        tools: {
            call: <R>(): Promise<R> => {
                const next = left.shift()
                return next === undefined ? Promise.reject(new Error("bank unreadable")) : Promise.resolve(next as R)
            },
        },
    }
}

const filled = (template: string, values: Readonly<Record<string, string>>): string =>
    Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), template)

const SLOT_DAILY = Date.parse("2026-11-09T14:00:00.000Z")
const SLOT_MONTH_END = Date.parse("2026-11-30T14:05:00.000Z")

const credit = (
    changes: Partial<CreditRead> & { readonly id: string; readonly direction?: string },
): Record<string, unknown> => ({
    amountVnd: 100_000,
    occurredAt: "2026-11-09T03:00:00.000Z",
    orderId: null,
    status: "unmatched",
    direction: "credit",
    externalRef: null,
    ...changes,
})

const movement = (id: string, amountVnd: number, occurredAt: string, direction: "credit" | "debit" = "credit") => ({
    id,
    direction,
    amountVnd,
    content: "",
    occurredAt,
    bankName: "MB",
})

const DAILY_STORE = {
    "bank-transaction": [
        credit({ id: "t1", amountVnd: 480_000, status: "matched", orderId: "order-lan", externalRef: "sepay-1" }),
        credit({
            id: "t2",
            amountVnd: 150_000,
            status: "matched",
            orderId: "order-hoa",
            externalRef: "sepay-2",
            occurredAt: "2026-11-09T05:00:00.000Z",
        }),
        credit({ id: "t3", amountVnd: 70_000, externalRef: "sepay-3", occurredAt: "2026-11-09T06:00:00.000Z" }),
        credit({
            id: "t4",
            amountVnd: 999_000,
            status: "matched",
            orderId: "order-old",
            occurredAt: "2026-11-08T03:00:00.000Z",
        }),
        credit({ id: "t5", amountVnd: 30_000, direction: "debit", externalRef: "sepay-d" }),
    ],
}

const BANK_9TH = {
    provider: "sepay",
    transactions: [
        movement("sepay-1", 480_000, "2026-11-09T03:00:00.000Z"),
        movement("sepay-2", 150_000, "2026-11-09T05:00:00.000Z"),
        movement("sepay-3", 70_000, "2026-11-09T06:00:00.000Z"),
        movement("sepay-9", 20_000, "2026-11-09T07:00:00.000Z"),
    ],
}

const MONTH_STORE = {
    "bank-transaction": [
        credit({
            id: "m1",
            amountVnd: 480_000,
            status: "matched",
            orderId: "order-lan",
            externalRef: "sepay-1",
            occurredAt: "2026-11-02T03:00:00.000Z",
        }),
        credit({
            id: "m2",
            amountVnd: 150_000,
            status: "unmatched",
            externalRef: "sepay-2",
            occurredAt: "2026-11-03T03:00:00.000Z",
        }),
        credit({
            id: "m3",
            amountVnd: 30_000,
            status: "other_income",
            externalRef: "sepay-3",
            occurredAt: "2026-11-05T03:00:00.000Z",
        }),
    ],
}

/** The bank's answer day by day for November: three credits and one debit, and a credit the system never received. */
const novemberAnswers = (): ReadonlyArray<unknown> =>
    Array.from({ length: 30 }, (_, index) => {
        const day = index + 1
        if (day === 2)
            return { provider: "sepay", transactions: [movement("sepay-1", 480_000, "2026-11-02T03:00:00.000Z")] }
        if (day === 3)
            return { provider: "sepay", transactions: [movement("sepay-2", 150_000, "2026-11-03T03:00:00.000Z")] }
        if (day === 5) {
            return {
                provider: "sepay",
                transactions: [
                    movement("sepay-3", 30_000, "2026-11-05T03:00:00.000Z"),
                    movement("sepay-d1", 90_000, "2026-11-05T04:00:00.000Z", "debit"),
                ],
            }
        }
        if (day === 7)
            return { provider: "sepay", transactions: [movement("sepay-7", 60_000, "2026-11-07T03:00:00.000Z")] }
        return { provider: "sepay", transactions: [] }
    })

interface Case {
    readonly name: string
    readonly input: { readonly slotMs: number; readonly locale: "vi" | "en" }
    readonly output: { readonly posted: boolean; readonly kind: "daily" | "month-end" }
    readonly effects: ReadonlyArray<{ readonly kind: string; readonly payload: unknown }>
    readonly store: Store
    readonly tools?: ReadonlyArray<unknown>
}

const CASES: ReadonlyArray<Case> = [
    {
        name: "the evening report: money in, orders paid, what waits, and the bank's difference, for that day only",
        input: { slotMs: SLOT_DAILY, locale: "vi" },
        output: { posted: true, kind: "daily" },
        effects: [
            {
                kind: TOOL.teamMessagePost,
                payload: {
                    kind: "report.accounting",
                    intent: "report",
                    title: filled(messageOf("vi", "accountingReportDailyTitle"), { day: "09/11/2026" }),
                    summary: filled(messageOf("vi", "accountingReportSummary"), {
                        in: amountTextOf(700_000, "vi"),
                        paid: "2",
                        unmatched: "1",
                    }),
                    payload: {
                        period: "daily",
                        rows: [
                            { label: messageOf("vi", "accountingReportIn"), value: amountTextOf(700_000, "vi") },
                            { label: messageOf("vi", "accountingReportPaidOrders"), value: "2" },
                            {
                                label: messageOf("vi", "accountingReportUnmatched"),
                                value: `1 · ${amountTextOf(70_000, "vi")}`,
                            },
                            {
                                label: messageOf("vi", "accountingReportDifference"),
                                value: `+${amountTextOf(20_000, "vi")}`,
                            },
                        ],
                        differences: [],
                        notes: [],
                        partial: false,
                    },
                },
            },
        ],
        store: DAILY_STORE,
        tools: [BANK_9TH],
    },
    {
        name: "a bank that cannot be read is said so, and the books' own figures are still reported",
        input: { slotMs: SLOT_DAILY, locale: "en" },
        output: { posted: true, kind: "daily" },
        effects: [
            {
                kind: TOOL.teamMessagePost,
                payload: {
                    kind: "report.accounting",
                    intent: "report",
                    title: filled(messageOf("en", "accountingReportDailyTitle"), { day: "09/11/2026" }),
                    summary: filled(messageOf("en", "accountingReportSummary"), {
                        in: amountTextOf(700_000, "en"),
                        paid: "2",
                        unmatched: "1",
                    }),
                    payload: {
                        period: "daily",
                        rows: [
                            { label: messageOf("en", "accountingReportIn"), value: amountTextOf(700_000, "en") },
                            { label: messageOf("en", "accountingReportPaidOrders"), value: "2" },
                            {
                                label: messageOf("en", "accountingReportUnmatched"),
                                value: `1 · ${amountTextOf(70_000, "en")}`,
                            },
                            {
                                label: messageOf("en", "accountingReportDifference"),
                                value: messageOf("en", "accountingReportBankUnknown"),
                            },
                        ],
                        differences: [],
                        notes: [],
                        partial: false,
                    },
                },
            },
        ],
        store: DAILY_STORE,
    },
    {
        name: "the last evening of the month adds the reconciliation: bank total against ledger total, every difference listed, tax note as guidance",
        input: { slotMs: SLOT_MONTH_END, locale: "vi" },
        output: { posted: true, kind: "month-end" },
        effects: [
            {
                kind: TOOL.teamMessagePost,
                payload: {
                    kind: "report.accounting",
                    intent: "report",
                    title: filled(messageOf("vi", "accountingReportDailyTitle"), { day: "30/11/2026" }),
                    summary: filled(messageOf("vi", "accountingReportSummary"), {
                        in: amountTextOf(0, "vi"),
                        paid: "0",
                        unmatched: "0",
                    }),
                    payload: {
                        period: "daily",
                        rows: [
                            { label: messageOf("vi", "accountingReportIn"), value: amountTextOf(0, "vi") },
                            { label: messageOf("vi", "accountingReportPaidOrders"), value: "0" },
                            {
                                label: messageOf("vi", "accountingReportUnmatched"),
                                value: `0 · ${amountTextOf(0, "vi")}`,
                            },
                            {
                                label: messageOf("vi", "accountingReportDifference"),
                                value: amountTextOf(0, "vi"),
                            },
                        ],
                        differences: [],
                        notes: [],
                        partial: false,
                    },
                },
            },
            {
                kind: TOOL.teamMessagePost,
                payload: {
                    kind: "report.accounting",
                    intent: "report",
                    title: filled(messageOf("vi", "accountingReportMonthTitle"), { month: "11/2026" }),
                    summary: filled(messageOf("vi", "accountingReportSummary"), {
                        in: amountTextOf(720_000, "vi"),
                        paid: "2",
                        unmatched: "2",
                    }),
                    payload: {
                        period: "month-end",
                        rows: [
                            { label: messageOf("vi", "accountingReportBankIn"), value: amountTextOf(720_000, "vi") },
                            { label: messageOf("vi", "accountingReportLedgerIn"), value: amountTextOf(510_000, "vi") },
                            {
                                label: messageOf("vi", "accountingReportDifference"),
                                value: `+${amountTextOf(210_000, "vi")}`,
                            },
                            {
                                label: messageOf("vi", "accountingReportDebits"),
                                value: `1 · ${amountTextOf(90_000, "vi")}`,
                            },
                        ],
                        differences: [
                            {
                                label: messageOf("vi", "accountingReportDiffWaiting"),
                                value: amountTextOf(150_000, "vi"),
                                detail: "sepay-2 · 03/11/2026",
                            },
                            {
                                label: messageOf("vi", "accountingReportDiffMissing"),
                                value: amountTextOf(60_000, "vi"),
                                detail: "sepay-7 · 07/11/2026",
                            },
                        ],
                        notes: [messageOf("vi", "accountingReportTaxNote")],
                        partial: false,
                    },
                },
            },
        ],
        store: MONTH_STORE,
        tools: [{ provider: "sepay", transactions: [] }, ...novemberAnswers()],
    },
]

describe("closeReportOf", () => {
    it.each(CASES.map((one) => [one.name, one] as const))("%s", async (_name, one) => {
        const report = await closeReportOf(portsOf(one.store, one.tools), one.input.slotMs, one.input.locale)

        expect(report.kind).toBe(one.output.kind)
        expect(report.posts.map((post) => post.payload)).toEqual(one.effects.map((effect) => effect.payload))
    })

    it("posts the daily card once per day and the reconciliation once per month", async () => {
        const report = await closeReportOf(
            portsOf({ "bank-transaction": [] }, [{ provider: "sepay", transactions: [] }]),
            Date.parse("2026-11-30T14:05:00.000Z"),
            "vi",
        )

        expect(report.posts.map((post) => post.dedupeKey)).toEqual([
            "accounting-daily:2026-11-30",
            "accounting-month:2026-11",
        ])
    })
})
