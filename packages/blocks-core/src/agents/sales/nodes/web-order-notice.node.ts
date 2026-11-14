import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../../shared/bounds"
import type { NodeLocale, NodeSchema } from "../../../shared/nodes/node-schema.types"
import { nodeGoalOf } from "../../../shared/nodes/node-ui"
import { POSTED } from "./care.examples"
import { askTeam, refusalSchema } from "./care.steps"
import { answered } from "../../../shared/nodes/tool-answers"
import { PRICE_FACT_LIST, priceFactsOf } from "./price-facts.reads"

const ID = "sales.web-order-notice"

/** What the website form gave: the customer, how to reach them, their request, and the team's language. */
export interface WebOrderNoticeInput {
    /** The customer the form made (`= steps.lead.output.leadId`). */
    readonly leadId: string
    /** What the customer asked for, free text (`= trigger.request`). */
    readonly request: string
    /** The phone the customer left, or null. */
    readonly phone: string | null
    /** The email the customer left, or null. */
    readonly email: string | null
    /** The language the team reads. */
    readonly locale: NodeLocale
}

/** What the step told the team. */
export interface WebOrderNoticeOutput {
    /** The customer, echoed. */
    readonly leadId: string
    /** One line for the team: who, what they want, how to call them. */
    readonly summary: string
    /** True when the team was told. */
    readonly told: boolean
    /** The post tool's refusal when it was not, else null. */
    readonly refusal: string | null
}

const input: NodeSchema<WebOrderNoticeInput> = z.object({
    leadId: z.string().max(MAX_ID).min(1),
    request: z.string().max(MAX_BODY),
    phone: z.string().max(MAX_LINE).nullable(),
    email: z.string().max(MAX_LINE).nullable(),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<WebOrderNoticeOutput> = z.object({
    leadId: z.string().max(MAX_ID).describe("The id of the customer, as given."),
    summary: z
        .string()
        .min(1)
        .max(MAX_LINE)
        .describe("One line for the team: what the customer wants and how to reach them."),
    told: z.boolean().describe("True when the team was told."),
    refusal: refusalSchema,
})

/** What the agent writes: the note for the team and the one-line summary the graph's outcome carries. */
interface WebOrderNote {
    readonly title: string
    readonly text: string
    readonly summary: string
}

const noteSchema: z.ZodType<WebOrderNote> = z.object({
    title: z.string().min(1).max(MAX_LINE).describe("A short title, in the team's language."),
    text: z.string().min(1).max(MAX_BODY).describe("The note, in the team's language."),
    summary: z
        .string()
        .min(1)
        .max(MAX_LINE)
        .describe("One line: what the customer wants and how to reach them. No price or total."),
})

const GUIDANCE =
    "The customer wrote through the website form, so nobody can answer them in a chat. Write the team a note, in the team's language " +
    "(`locale`), to call the customer to confirm the order: who, what they asked for, the products it matches in `prices` (the shop's truths " +
    "that carry a number: subject, attribute, value, unit, `num`), with the price the truth gives, exactly, the phone or email. Never type a price " +
    "`prices` does not give, and never a total."

const NOTE = {
    title: "\u0110\u01a1n web m\u1edbi: g\u1ecdi x\u00e1c nh\u1eadn",
    text: "Kh\u00e1ch \u0111\u1eb7t 2 Gi\u1ecf nh\u1ecf giao t\u1edbi 25 Nguy\u1ec5n Hu\u1ec7 qua website. G\u1ecdi 0900000000 \u0111\u1ec3 x\u00e1c nh\u1eadn \u0111\u01a1n.",
    summary: "Kh\u00e1ch web \u0111\u1eb7t 2 Gi\u1ecf nh\u1ecf, g\u1ecdi 0900000000 \u0111\u1ec3 x\u00e1c nh\u1eadn",
}

/**
 * `sales.web-order-notice` (Bao doi goi khach web): the agent matches the request against the shop's price truths (the
 * numeric truths of the truth graph, their exact figure) and writes the team a note to call the customer back; the node posts it as a
 * question (`nivo.tool.team.message.post`). The graph's purpose: blocking. Nothing to the customer (there is no chat to answer in).
 */
export const salesWebOrderNoticeNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: { key: "nodeSalesWebOrderNoticeTitle" },
    description: { vi: "\u0110\u1ed1i chi\u1ebfu y\u00eau c\u1ea7u t\u1eeb website v\u1edbi s\u1ea3n ph\u1ea9m \u0111ang b\u00e1n v\u00e0 b\u00e1o \u0111\u1ed9i g\u1ecdi l\u1ea1i cho kh\u00e1ch.", en: "Matches the website request against the products on sale and tells the team to call the customer back." },
    tools: [TOOL.brainFactList, TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const prices = await priceFactsOf(context)
        const note = await context.agent.run({
            goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE}`,
            input: {
                ...given,
                prices: prices.map(({ subject, attribute, value, unit, num }) => ({ subject, attribute, value, unit, num })),
            },
            output: noteSchema,
            tools: [],
            maxTurns: 1,
        })
        const posted = await askTeam(context, { title: note.title, text: note.text })
        return { leadId: given.leadId, summary: note.summary, told: posted.sent, refusal: posted.refusal }
    },
    examples: [
        {
            name: "asks the team to call the customer back, with the products the request matches",
            params: {},
            input: {
                leadId: "lead-1",
                request: "2 gi\u1ecf nh\u1ecf giao t\u1edbi 25 Nguy\u1ec5n Hu\u1ec7",
                phone: "0900000000",
                email: null,
                locale: "vi",
            },
            tools: [
                {
                    id: TOOL.brainFactList,
                    args: PRICE_FACT_LIST,
                    answer: answered({
                        facts: [{ id: "f1", subject: "Gi\u1ecf nh\u1ecf", attribute: "gi\u00e1", value: "200.000 \u0111", unit: null, num: 200000, trust: 95 }],
                    }),
                },
                {
                    id: TOOL.teamMessagePost,
                    args: { kind: "message.text", intent: "ask", title: NOTE.title, text: NOTE.text },
                    answer: POSTED,
                },
            ],
            agent: [{ answer: NOTE }],
            output: { leadId: "lead-1", summary: NOTE.summary, told: true, refusal: null },
        },
    ],
})
