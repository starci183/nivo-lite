import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { refused, ZALO, sentOn } from "./webrenew.examples"
import { z } from "zod"
import { type AnswerSource, lineSchema, optionalId } from "./answer-shapes"
import { ID_MAX, REPLY_MAX, channelSchema, localeSchema } from "./renew-shapes"
import { reachOfIds, tellCustomer, toldOf } from "./webrenew.calls"
import { webrenewText } from "../../modules/webrenew/copy"

/** The customer's words, the team's line about them, and where they said it. */
type CloseThankInput = AnswerSource & {
    readonly text: string
    readonly summary: string
}

/** The line sent (null when the agent chose to send none), the channel it went through, and a send's refusal. */
type CloseThankOutput = {
    readonly reply: string | null
    readonly channel: string | null
    readonly refusal: string | null
}

const ID = "webrenew.close-thank"

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<CloseThankInput> = z.object({
    text: z.string().min(1).max(REPLY_MAX),
    summary: lineSchema,
    conversationId: optionalId,
    contactId: optionalId,
    locale: localeSchema,
})
const output: z.ZodType<CloseThankOutput> = z.object({
    reply: z.string().min(1).max(REPLY_MAX).nullable(),
    channel: channelSchema,
    refusal: z.string().min(1).max(ID_MAX).nullable(),
})

/** What the agent decides: one short line, or none (ADDENDUM 10: the old goal left it to the agent's judgement). */
const decision = z.object({
    reply: z
        .string()
        .min(1)
        .max(REPLY_MAX)
        .nullable()
        .describe(
            "One short line to the customer in their language, or null when the truths and the shop's voice call for none.",
        ),
})

const GOAL =
    "The customer does not renew; the team is told. Whether to answer the customer, and what, follows the truths and the shop's " +
    "voice: when you do, one short line; promise nothing. Write the line, or null for none: the step sends it."

const THANKS = "Da em ghi nhan a. Cam on anh da dong hanh cung ben em."

const GIVEN: CloseThankInput = {
    text: "Thoi em, ben anh chuyen nha cung cap roi",
    summary: "Khach KH-002 khong gia han hosting sample.vn vi da chuyen nha cung cap.",
    conversationId: "c2",
    contactId: null,
    locale: "vi",
}

/**
 * `webrenew.close-thank` (Thank the customer): a side step (`blocking: false`) after the decline. The agent decides whether one
 * short line is due and writes it; the step sends it in the customer's conversation (`auto`) only when the agent wrote one.
 * A run with no conversation and no lead sends nothing. A refused send is said in the output.
 */
export const webrenewCloseThankNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.closeThank.title"),
    description: { vi: "G\u1eedi kh\u00e1ch m\u1ed9t l\u1eddi c\u1ea3m \u01a1n ng\u1eafn khi kh\u00e1ch kh\u00f4ng gia h\u1ea1n, n\u1ebfu th\u1ea5y c\u1ea7n.", en: "Sends the customer a short thank-you when they decline to renew, if one is due." },
    tools: [TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (given, context) => {
        const reach = reachOfIds(given.conversationId, given.contactId)
        if (reach === null) return { reply: null, channel: null, refusal: null }
        const decided = await context.agent.run({
            goal: GOAL,
            input: { text: given.text, summary: given.summary, locale: given.locale },
            output: decision,
            tools: [],
            maxTurns: 2,
        })
        if (decided.reply === null) return { reply: null, channel: null, refusal: null }
        const sent = await tellCustomer(context, reach, { subject: null, text: decided.reply }, null)
        if (!sent.ok) return { reply: decided.reply, channel: null, refusal: sent.declined === true ? "declined" : sent.refusal }
        return { reply: decided.reply, channel: toldOf(reach, sent).channel, refusal: null }
    },
    examples: [
        {
            name: "thanks the customer in one line when the shop's voice calls for it",
            params: {},
            input: GIVEN,
            agent: [{ answer: { reply: THANKS } }],
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { text: THANKS },
                    answer: sentOn(ZALO, "msg-3", "c2"),
                },
            ],
            output: { reply: THANKS, channel: ZALO, refusal: null },
        },
        {
            name: "sends nothing when the agent decides no line is due",
            params: {},
            input: GIVEN,
            agent: [{ answer: { reply: null } }],
            output: { reply: null, channel: null, refusal: null },
        },
        {
            name: "a refused send is said in the output",
            params: {},
            input: GIVEN,
            agent: [{ answer: { reply: THANKS } }],
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { text: THANKS },
                    answer: refused("outside_window"),
                },
            ],
            output: { reply: THANKS, channel: null, refusal: "outside_window" },
        },
        {
            name: "a person declines the line: said in the output as their decision",
            params: {},
            input: GIVEN,
            agent: [{ answer: { reply: THANKS } }],
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { text: THANKS },
                    answer: refused("declined"),
                },
            ],
            output: { reply: THANKS, channel: null, refusal: "declined" },
        },
    ],
})
