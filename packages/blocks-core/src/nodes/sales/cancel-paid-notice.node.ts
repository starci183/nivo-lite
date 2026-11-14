import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf, messageOf } from "../../messages/catalog"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { answered, refused } from "../tool-answers"
import { askTeam, refusalSchema, teamNoteSchema } from "./care.steps"

/** A customer asked to cancel an order that is already paid: the order, and the words. */
export interface CancelPaidNoticeInput {
    /** The order's code. */
    readonly orderNo: string
    /** Why, as the customer said it; null when the consult kept no reason. */
    readonly reason: string | null
    /** What the customer wrote. */
    readonly text: string
    /** The language the team reads. */
    readonly locale: NodeLocale
}

/** Whether the team was told. */
export interface CancelPaidNoticeOutput {
    /** True once the note was posted. */
    readonly told: boolean
    /** The post's refusal when it was refused, else null. */
    readonly refusal: string | null
}

const input: NodeSchema<CancelPaidNoticeInput> = z.object({
    orderNo: z.string().min(1).max(MAX_ID),
    reason: z.string().min(1).max(MAX_LINE).nullable(),
    text: z.string().max(MAX_BODY),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<CancelPaidNoticeOutput> = z.object({
    told: z.boolean().describe("True once the note reached the team."),
    refusal: refusalSchema,
})

/** How the agent of the step writes: the guidance of the goal, never a line it must say. */
const GUIDANCE =
    "A customer asked to cancel order `orderNo`, which is already PAID: the order stays as it is. Write the team a short note, in " +
    "`locale`, with the order code and the customer's own words (`text`, `reason`), so a person decides (a refund is the team's). Never " +
    "promise anything and never type an amount."

/** The note of the examples, as the agent writes it. */
const NOTE = {
    title: "Kh\u00e1ch xin hu\u1ef7 \u0111\u01a1n \u0111\u00e3 tr\u1ea3 DH-20261113-0001",
    text: "Kh\u00e1ch vi\u1ebft: \"hu\u1ef7 gi\u00fap em \u0111\u01a1n DH-20261113-0001\". \u0110\u01a1n \u0111\u00e3 thanh to\u00e1n, ch\u01b0a hu\u1ef7: anh/ch\u1ecb xem gi\u00fap.",
}

/** The claim of the examples. */
const GIVEN: CancelPaidNoticeInput = {
    orderNo: "DH-20261113-0001",
    reason: "no longer needed",
    text: "hu\u1ef7 gi\u00fap em \u0111\u01a1n DH-20261113-0001",
    locale: "vi",
}

/**
 * `sales.cancel-paid-notice` (Bao doi khach xin huy don da tra): a customer asked to cancel an order that is already paid (the graph read
 * the order and compared its status exactly). The node changes nothing: the agent writes the team a note with the order's code and the
 * customer's words, the node posts it (`nivo.tool.team.message.post`, a question for a person). The order stays as it is.
 */
export const salesCancelPaidNoticeNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.cancel-paid-notice",
    title: bilingualOf("nodeSalesCancelPaidNoticeTitle"),
    description: { vi: "B\u00e1o \u0111\u1ed9i khi kh\u00e1ch xin hu\u1ef7 \u0111\u01a1n \u0111\u00e3 thanh to\u00e1n, k\u00e8m m\u00e3 \u0111\u01a1n v\u00e0 l\u1eddi kh\u00e1ch. \u0110\u01a1n \u0111\u01b0\u1ee3c gi\u1eef nguy\u00ean.", en: "Tells the team when a customer asks to cancel an order that is already paid, with the order code and the customer's words. The order stays as it is." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const note = await context.agent.run({
            goal: `${messageOf("en", "nodeSalesCancelPaidNoticeGoal")}\n${GUIDANCE}`,
            input: { orderNo: given.orderNo, reason: given.reason, text: given.text, locale: given.locale },
            output: teamNoteSchema,
            tools: [],
            maxTurns: 1,
        })
        const posted = await askTeam(context, note)
        return { told: posted.sent, refusal: posted.refusal }
    },
    examples: [
        {
            name: "a customer asks to cancel a paid order: the team is told the code and the customer's words; the order is untouched",
            params: {},
            input: GIVEN,
            agent: [{ answer: NOTE }],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: { kind: "message.text", intent: "ask", ...NOTE },
                    answer: answered({ messageId: "team-message-1" }),
                },
            ],
            output: { told: true, refusal: null },
        },
        {
            name: "a note the chat refuses is said in the output",
            params: {},
            input: GIVEN,
            agent: [{ answer: NOTE }],
            tools: [
                { id: TOOL.teamMessagePost, args: { kind: "message.text", intent: "ask", ...NOTE }, answer: refused("other_room") },
            ],
            output: { told: false, refusal: "other_room" },
        },
    ],
})
