import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { bilingualOf, messageOf } from "../../messages/catalog"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { answered, refused } from "../tool-answers"

/** The order the sale stopped waiting for, for the team to follow up. */
export interface UnpaidNoticeInput {
    /** The order's code. */
    readonly orderNo: string
    /** The order's total, VND. */
    readonly amountVnd: number
    /** The language the team reads. */
    readonly locale: NodeLocale
}

/** Whether the team was told. */
export interface UnpaidNoticeOutput {
    /** True once the notice was posted. */
    readonly posted: boolean
    /** The post's refusal when it was refused, else null. */
    readonly refusal: string | null
}

const input: NodeSchema<UnpaidNoticeInput> = z.object({
    orderNo: z.string().min(1).max(MAX_ID),
    amountVnd: z.number().int().min(0),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<UnpaidNoticeOutput> = z.object({
    posted: z.boolean().describe("True once the notice was posted to the team."),
    refusal: z.string().max(MAX_ID).nullable().describe("The post tool's refusal when it refused, else null."),
})

/** The post as `nivo.tool.team.message.post` takes it: one catalogue line telling (`notify`) the founder the order and its total. */
const noticeOf = (given: UnpaidNoticeInput): JsonObject => ({
    kind: "message.text",
    intent: "notify",
    audience: "founder",
    title: messageOf(given.locale, "nodeSalesUnpaidNoticeHeading"),
    text: messageOf(given.locale, "nodeSalesUnpaidNoticeLine")
        .replaceAll("{order}", given.orderNo)
        .replaceAll("{amount}", String(given.amountVnd)),
})

/** The order of the examples. */
const UNPAID: UnpaidNoticeInput = { orderNo: "DH-20261113-0001", amountVnd: 4500, locale: "en" }

/**
 * `sales.unpaid-notice` (Bao doi don chua tra): the sale's payment wait ran out of rounds (every reminder sent, no credit paid the order).
 * The run ends `unpaid`, never silently (ruling R45): the founder is told on /chat which order and its total, for a person to follow up.
 * One catalogue line, no AI call, no customer text. A side step (`blocking: false`): a notice that cannot be posted is said in the output.
 */
export const salesUnpaidNoticeNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.unpaid-notice",
    title: bilingualOf("nodeSalesUnpaidNoticeTitle"),
    description: {
        vi: "Báo đội một đơn đã nhắc hết lượt mà vẫn chưa được trả tiền, kèm mã đơn và tổng tiền, để một người theo dõi.",
        en: "Tells the team about an order still unpaid after every reminder, with its code and total, for a person to follow up.",
    },
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
            name: "the founder is told the code and the total of the order the sale stopped waiting for",
            params: {},
            input: UNPAID,
            tools: [{ id: TOOL.teamMessagePost, args: noticeOf(UNPAID), answer: answered({ messageId: "team-message-1" }) }],
            output: { posted: true, refusal: null },
        },
        {
            name: "a refused post is said in the output; the run still ends unpaid",
            params: {},
            input: UNPAID,
            tools: [{ id: TOOL.teamMessagePost, args: noticeOf(UNPAID), answer: refused("not_granted") }],
            output: { posted: false, refusal: "not_granted" },
        },
    ],
})
