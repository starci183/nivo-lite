import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../bounds"
import { bilingualOf, messageOf } from "../../messages/catalog"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { answered, refused } from "../tool-answers"

/** The longest quote of the customer's words the notice carries. */
const QUOTE_MAX = 500

/** The message handed to the sale that was judged not about buying, for the team to answer. */
export interface NotSaleNoticeInput {
    /** The route the message came on (the engine's id of this person on this entrance). */
    readonly routeId: string
    /** The customer's words, as handed on. */
    readonly text: string
    /** The language the team reads. */
    readonly locale: NodeLocale
}

/** Whether the team was told. */
export interface NotSaleNoticeOutput {
    /** True once the notice was posted. */
    readonly posted: boolean
    /** The post's refusal when it was refused, else null. */
    readonly refusal: string | null
}

const input: NodeSchema<NotSaleNoticeInput> = z.object({
    routeId: z.string().min(1).max(MAX_ID),
    text: z.string().max(MAX_BODY),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<NotSaleNoticeOutput> = z.object({
    posted: z.boolean().describe("True once the notice was posted to the team."),
    refusal: z.string().max(MAX_ID).nullable().describe("The post tool's refusal when it refused, else null."),
})

/** The words quoted, cut to the notice's bound. */
const quoteOf = (text: string): string => (text.length > QUOTE_MAX ? `${text.slice(0, QUOTE_MAX)}…` : text)

/** The post as `nivo.tool.team.message.post` takes it: one catalogue line telling (`notify`) the founder, the route and the words quoted. */
const noticeOf = (given: NotSaleNoticeInput): JsonObject => ({
    kind: "message.text",
    intent: "notify",
    audience: "founder",
    title: messageOf(given.locale, "nodeSalesNotSaleNoticeHeading"),
    text: messageOf(given.locale, "nodeSalesNotSaleNoticeLine")
        .replaceAll("{route}", given.routeId)
        .replaceAll("{text}", quoteOf(given.text)),
})

/** The message of the examples. */
const HANDED: NotSaleNoticeInput = { routeId: "route-1", text: "Do you have a job opening?", locale: "en" }

/**
 * `sales.not-sale-notice` (Bao doi tin nhan khong ve mua hang): the sale's first message was judged not about buying (the consult's
 * model said so; nothing was sent to the customer and there is no wait to hand it back to). An unhandled case is never silent (R41 Q10):
 * the founder is told on /chat which route it came on and the customer's words, for a person to answer. One catalogue line, no AI call,
 * no customer text. A side step (`blocking: false`): a notice that cannot be posted is said in the output.
 */
export const salesNotSaleNoticeNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.not-sale-notice",
    title: bilingualOf("nodeSalesNotSaleNoticeTitle"),
    description: {
        vi: "Báo đội một tin nhắn chuyển sang bán hàng nhưng không về việc mua, kèm tuyến và lời của khách, để một người trả lời.",
        en: "Tells the team about a message handed to the sale that is not about buying, with its route and the customer's words, for a person to answer.",
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
            name: "the founder is told the route and the customer's words of a message not about buying",
            params: {},
            input: HANDED,
            tools: [{ id: TOOL.teamMessagePost, args: noticeOf(HANDED), answer: answered({ messageId: "team-message-1" }) }],
            output: { posted: true, refusal: null },
        },
        {
            name: "a refused post is said in the output; the run still ends",
            params: {},
            input: HANDED,
            tools: [{ id: TOOL.teamMessagePost, args: noticeOf(HANDED), answer: refused("not_granted") }],
            output: { posted: false, refusal: "not_granted" },
        },
    ],
})
