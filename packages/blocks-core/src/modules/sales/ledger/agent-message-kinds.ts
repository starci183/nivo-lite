import { z } from "zod"
import { defineAgentMessageKind, type AgentMessageKind } from "@nivo-lite/agent-sdk/team-chat"

const T = 500

/** One figure of a report: what it is and its value, both in words. */
export interface AccountingReportRow {
    /** What the figure is. */
    readonly label: string
    /** The figure, with its currency or its count. */
    readonly value: string
}

/** One credit the bank has and the ledger does not have as the bank does. */
export interface AccountingReportDifference {
    /** Why it differs, in words. */
    readonly label: string
    /** The amount with its currency. */
    readonly value: string
    /** The bank reference and the day. */
    readonly detail: string
}

/** The evening report of the books or the month-end reconciliation, as the card draws it. */
export interface AccountingReportPayload {
    /** The daily report, or the month-end reconciliation. */
    readonly period: "daily" | "month-end"
    /** The figures. */
    readonly rows: ReadonlyArray<AccountingReportRow>
    /** The credits behind a difference between the bank and the ledger; empty for a daily report. */
    readonly differences: ReadonlyArray<AccountingReportDifference>
    /** Lines of guidance; never a tax filing. */
    readonly notes: ReadonlyArray<string>
    /** True when the figures are provisional (more transactions than one run could check). */
    readonly partial: boolean
}

const rowSchema: z.ZodType<AccountingReportRow> = z.object({ label: z.string().max(T), value: z.string().max(T) })
const differenceSchema: z.ZodType<AccountingReportDifference> = z.object({
    label: z.string().max(T),
    value: z.string().max(T),
    detail: z.string().max(T),
})

/** The evening report of the books or the month-end reconciliation. Read only. */
export const accountingReportKind: AgentMessageKind<z.ZodType<AccountingReportPayload>> = defineAgentMessageKind({
    id: "report.accounting",
    payload: z.object({
        period: z.enum(["daily", "month-end"]),
        rows: z.array(rowSchema).max(20),
        differences: z.array(differenceSchema).max(50),
        notes: z.array(z.string().max(2000)).max(10),
        partial: z.boolean(),
    }),
    actions: { approve: false, edit: "none", reject: false },
})

/** The kinds the accounting flows register. */
export const accountingAgentMessageKinds: ReadonlyArray<AgentMessageKind> = [accountingReportKind]
