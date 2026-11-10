import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { bilingualOf } from "../../messages/catalog"
import { shopDayOf } from "../../rules/accounting/shop-time"
import { TOOL } from "../../vocabulary/tool-ids"
import { nodeGoalOf } from "../node-ui"
import type { NodeLocale, NodeSchema } from "../node-schema.types"

const ID = "accounting.report"

/** The clock slot the close was fired for (epoch milliseconds) and the language of the card. */
interface ReportInput {
    readonly slotMs: number
    readonly locale: NodeLocale
}

/** What the close did. */
interface ReportOutput {
    /** The shop day closed, `YYYY-MM-DD`. */
    readonly day: string
    /** True when the report card was posted. */
    readonly posted: boolean
}

const params: NodeSchema<Record<string, never>> = z.object({})
const input: NodeSchema<ReportInput> = z.object({
    slotMs: z.number().int().positive(),
    locale: z.enum(["vi", "en"]),
})
const output: NodeSchema<ReportOutput> = z.object({
    day: z.string().max(10).describe("The shop day closed, YYYY-MM-DD, as given."),
    posted: z.boolean().describe("True when the close tool posted the report card."),
})

const GUIDANCE =
    "Call the daily close tool once for `day`: it computes the figures from the records and posts the report card to the team (on the " +
    "last day of the month the reconciliation too). Never type a figure yourself."

/**
 * `accounting.report` (Báo cáo cuối ngày): every evening the agent closes the day with the `nivo.report.daily.close` tool, which computes the
 * day's figures (and the month-end reconciliation on the last evening) from the records and posts the report card to the team. The figures
 * are money, so the agent never types them (`closeReportOf` in `close-report.ts` is the body the tool's executor runs). A side step.
 * The report reads NIVO's own books and the bank's list, not the Google Sheet the ledger step writes to.
 */
export const accountingReportNode: NodeDefinition<
    NodeSchema<ReportInput>,
    NodeSchema<ReportOutput>,
    NodeSchema<Record<string, never>>
> = defineNode({
    id: ID,
    role: "output",
    title: bilingualOf("nodeAccountingReportTitle"),
    params,
    input,
    output,
    rights: [],
    effects: [TOOL.reportDailyClose],
    requires: [TOOL.reportDailyClose],
    blocking: false,
    run: async (given, context) => {
        const decision = await context.agent.run({
            goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE}`,
            input: { day: shopDayOf(new Date(given.slotMs).toISOString()), locale: given.locale },
            output,
            maxTurns: 3,
            purpose: "daily-close",
        })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        return decision.value
    },
    examples: [
        {
            name: "closes the evening's day with the close tool, which posts the card",
            params: {},
            input: { slotMs: Date.parse("2026-11-09T14:00:00.000Z"), locale: "vi" },
            output: { day: "2026-11-09", posted: true },
            model: [
                { call: { tool: TOOL.reportDailyClose, args: { day: "2026-11-09" } } },
                { done: { day: "2026-11-09", posted: true } },
            ],
            effects: [{ kind: TOOL.reportDailyClose, payload: { day: "2026-11-09" } }],
        },
    ],
})
