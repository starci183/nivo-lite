import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { bilingualOf, messageOf } from "../../../shared/messages/catalog"
import type { NodeLocale, NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused } from "../../../shared/nodes/tool-answers"

/** The credit read exactly, for the team to settle by hand. */
export interface CreditNoticeInput {
    /** The raw bank row. */
    readonly transactionId: string
    /** The amount that came in, VND. */
    readonly amountVnd: number
    /** The transfer content, as the bank reported it. */
    readonly content: string
    /** The language the team reads. */
    readonly locale: NodeLocale
}

/** Whether the team was told. */
export interface CreditNoticeOutput {
    /** True once the notice was posted. */
    readonly posted: boolean
    /** The post's refusal when it was refused, else null. */
    readonly refusal: string | null
}

const input: NodeSchema<CreditNoticeInput> = z.object({
    transactionId: z.string().min(1).max(MAX_ID),
    amountVnd: z.number().int(),
    content: z.string().max(MAX_LINE),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<CreditNoticeOutput> = z.object({
    posted: z.boolean().describe("True once the notice was posted to the team."),
    refusal: z.string().max(MAX_ID).nullable().describe("The post tool's refusal when it refused, else null."),
})

/** The post as `nivo.tool.team.message.post` takes it: one catalogue line telling (`notify`) the founder of the credit, as the bank reported it. */
const noticeOf = (given: CreditNoticeInput): JsonObject => ({
    kind: "message.text",
    intent: "notify",
    audience: "founder",
    title: messageOf(given.locale, "nodeSalesCreditNoticeHeading"),
    text: messageOf(given.locale, "nodeSalesCreditNoticeLine")
        .replaceAll("{amount}", String(given.amountVnd))
        .replaceAll("{content}", given.content),
})

/** The credit of the examples. */
const CREDIT: CreditNoticeInput = { transactionId: "tx-1", amountVnd: 4500, content: "CK DH-20261113-0001 Lan", locale: "en" }

/**
 * `sales.credit-notice` (Bao doi khoan tien ve): tells the founder on /chat of a credit the payment graph does not settle by itself: its
 * amount and transfer content exactly as the bank reported them, for a person to settle (the edge to the team). One catalogue line, no AI
 * call; the amount is the bank's own figure. A side step (`blocking: false`): a notice that cannot be posted is said in the output.
 */
export const salesCreditNoticeNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.credit-notice",
    title: bilingualOf("nodeSalesCreditNoticeTitle"),
    description: { vi: "B\u00e1o \u0111\u1ed9i m\u1ed9t kho\u1ea3n ti\u1ec1n v\u1ec1 m\u00e0 quy tr\u00ecnh thanh to\u00e1n ch\u01b0a t\u1ef1 x\u1eed l\u00fd \u0111\u01b0\u1ee3c, k\u00e8m s\u1ed1 ti\u1ec1n v\u00e0 n\u1ed9i dung chuy\u1ec3n kho\u1ea3n \u0111\u00fang nh\u01b0 ng\u00e2n h\u00e0ng b\u00e1o.", en: "Tells the team about an incoming payment the payment flow cannot settle by itself, with the amount and transfer content exactly as the bank reported them." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input,
    output,
    blocking: false,
    run: async (given, context) => {
        const posted = await context.tools.call(TOOL.teamMessagePost, noticeOf(given))
        return posted.ok ? { posted: true, refusal: null } : { posted: false, refusal: posted.declined === true ? "declined" : posted.refusal }
    },
    examples: [
        {
            name: "the founder is told the credit's amount and transfer content, exactly as the bank reported them",
            params: {},
            input: CREDIT,
            tools: [{ id: TOOL.teamMessagePost, args: noticeOf(CREDIT), answer: answered({ messageId: "team-message-1" }) }],
            output: { posted: true, refusal: null },
        },
        {
            name: "a notice the chat refuses is said in the output; the run still ends",
            params: {},
            input: CREDIT,
            tools: [{ id: TOOL.teamMessagePost, args: noticeOf(CREDIT), answer: refused("other_room") }],
            output: { posted: false, refusal: "other_room" },
        },
    ],
})
