import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webbooksText } from "../../modules/webbooks/copy"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { LINE_MAX, ROUND_MAX, type TeamLocale, dateSchema, idSchema, lineSchema, localeSchema } from "./books-shapes"
import { TRUTHS_NOTICE, crmOk, ownOk } from "./books.fixtures"

/** One receivable to remind this round: the project, its customer, its dates as the CRM listed them, and why it is due today. */
export type DueReceivable = {
    /** The project receivable's code, as the CRM listed it. */
    readonly projectCode: string
    /** Its customer's code, as the CRM listed it; null when it listed none. */
    readonly customerCode: string | null
    /** When it fell due, as the CRM listed it. */
    readonly dueOn: string | null
    /** When it was last noticed, as the CRM listed it. */
    readonly lastNoticeOn: string | null
    /** One line: which truth makes it due for a reminder today. */
    readonly why: string
}

/** One receivable the round holds back today, and why (the rhythm truth, a note of the team, a missing customer). */
export type HeldReceivable = {
    /** The code of the project the receivable belongs to. */
    readonly projectCode: string
    /** The reason the receivable is kept back. */
    readonly why: string
}

/** What the step answers: what to remind today and what it holds. The graph's `ifNode` ends the round when both are empty. */
export type DueOutput = {
    /** The items that are due this round. */
    readonly due: ReadonlyArray<DueReceivable>
    /** The items kept back from this round, with the reason for each. */
    readonly held: ReadonlyArray<HeldReceivable>
}

/** The members of one receivable due today. */
const dueShape = {
    projectCode: idSchema.describe("The `projectCode` the CRM listed."),
    customerCode: idSchema.nullable().describe("The `customerCode` the CRM listed; null when it listed none."),
    dueOn: dateSchema.describe("The `dueOn` the CRM listed."),
    lastNoticeOn: dateSchema.describe("The `lastNoticeOn` the CRM listed."),
    why: z.string().min(1).max(LINE_MAX).describe("One line: which truth makes it due for a reminder today."),
}

/** The schema of one receivable due today, shared with the round's report. */
export const dueReceivableSchema: z.ZodType<DueReceivable> = z.object(dueShape)

/** The schema of a due receivable as the loop hands it to a body step, with the team's language. */
export const dueItemSchema: z.ZodType<DueReceivable & { readonly locale: TeamLocale }> = z.object({
    ...dueShape,
    locale: localeSchema,
})

/** The schema of one receivable held back, shared with the round's report. */
export const heldReceivableSchema: z.ZodType<HeldReceivable> = z.object({
    projectCode: idSchema.describe("The `projectCode` the CRM listed."),
    why: lineSchema.describe("One line: why it is not reminded today."),
})

const input = z.object({ locale: localeSchema })

const output: z.ZodType<DueOutput> = z.object({
    due: z.array(dueReceivableSchema).max(ROUND_MAX).describe("The receivables to remind today; empty when none."),
    held: z
        .array(heldReceivableSchema)
        .max(ROUND_MAX)
        .describe("The listed receivables you hold back today; empty when none."),
})

/** The reads the agent may make: the CRM's due list and a customer's balance, the company's truths. */
const READS = [CRM_NIVOWEB.get_receivables_overdue, CRM_NIVOWEB.get_customers_code_balance]

const GOAL =
    `List the project receivables that are due (\`limit\` ${String(ROUND_MAX)}). What the CRM lists (\`dueOn\`, \`lastNoticeOn\` and ` +
    "the rest) are facts, never a verdict: search the company's truths for the instalment terms and the reminder rhythm and apply them " +
    "to each row, to say which are due for a reminder `today` (the shop's own calendar day, given) and which you hold back and why. Only project receivables are collections: " +
    "a TK131 balance alone is never a debt. Copy codes and dates as the CRM listed them."

const OVERDUE = {
    items: [
        {
            projectCode: "SITE2-WEB",
            customerCode: "KH-0002",
            dueOn: "2026-10-30",
            lastNoticeOn: null,
            remainingVnd: 10_000_000,
        },
        {
            projectCode: "SITE3-WEB",
            customerCode: "KH-0003",
            dueOn: "2026-10-01",
            lastNoticeOn: "2026-11-10",
            remainingVnd: 15_000_000,
        },
    ],
    nextCursor: null,
}

/** The rhythm truth of the example, as the truth search answers it. */
const RHYTHM = {
    notice: TRUTHS_NOTICE,
    facts: [{ id: "f-rhythm", text: "Nhac cong no moi 7 ngay, bao nguoi phu trach truoc." }],
}

/** The due receivable of the worked examples (also the loop body's item). */
export const DUE_EXAMPLE: DueReceivable = {
    projectCode: "SITE2-WEB",
    customerCode: "KH-0002",
    dueOn: "2026-10-30",
    lastNoticeOn: null,
    why: "Qua han tu 30/10, chua nhac lan nao.",
}

/** The held receivable of the worked examples. */
export const HELD_EXAMPLE: HeldReceivable = {
    projectCode: "SITE3-WEB",
    why: "Da nhac ngay 10/11, chua du 7 ngay theo nhip nhac.",
}

/**
 * `webbooks.due` (Find what is due), converted in place: the agent lists the CRM's due project receivables and applies the
 * company's truths (instalment terms, reminder rhythm) to the CRM's facts: due today (the run's day in the workspace's time zone,
 * `run.day`), or held with a reason. Reads only. Today's
 * `branch` member goes: whether anything is due or held is an exact emptiness check, the graph's `ifNode` (`work`) on the two
 * lists.
 */
export const webbooksDueNode: TemplateNode = defineTemplateNode({
    id: "webbooks.due",
    title: webbooksText("node.due.title"),
    description: { vi: "T\u00ecm c\u00e1c kho\u1ea3n ph\u1ea3i thu c\u1ee7a d\u1ef1 \u00e1n \u0111\u00e3 \u0111\u1ebfn h\u1ea1n h\u00f4m nay, v\u00e0 gi\u1eef l\u1ea1i kho\u1ea3n ch\u01b0a \u0111\u1ebfn l\u00fac nh\u1eafc k\u00e8m l\u00fd do.", en: "Finds the project receivables that are due today and holds back those not yet due for a reminder, with the reason." },
    tools: READS,
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input,
    output,
    model: "claude-sonnet-5-5",
    requires: [CRM_NIVOWEB.get_receivables_overdue],
    run: (given, ctx) =>
        ctx.agent.run({ goal: GOAL, input: { ...given, today: ctx.run.day }, output, maxTurns: 5, tools: READS }),
    examples: [
        {
            name: "applies the rhythm truth to the CRM's facts: one due today, one held",
            params: {},
            input: { locale: "vi" },
            agent: [
                {
                    answer: { due: [DUE_EXAMPLE], held: [HELD_EXAMPLE] },
                    calls: [
                        { id: CRM_NIVOWEB.get_receivables_overdue, args: { limit: ROUND_MAX }, answer: crmOk(OVERDUE) },
                        { id: TOOL.brainSearch, args: { query: "nhip nhac cong no" }, answer: ownOk(RHYTHM) },
                    ],
                },
            ],
            output: { due: [DUE_EXAMPLE], held: [HELD_EXAMPLE] },
        },
        {
            name: "answers two empty lists when nothing is listed (the graph's ifNode ends the round)",
            params: {},
            input: { locale: "vi" },
            agent: [
                {
                    answer: { due: [], held: [] },
                    calls: [
                        {
                            id: CRM_NIVOWEB.get_receivables_overdue,
                            args: { limit: ROUND_MAX },
                            answer: crmOk({ items: [], nextCursor: null }),
                        },
                    ],
                },
            ],
            output: { due: [], held: [] },
        },
    ],
})
