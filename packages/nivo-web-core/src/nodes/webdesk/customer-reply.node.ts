import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { sayToCustomer, sentAnswer } from "@nivo-lite/blocks-core"
import { refused } from "../web-answers"
import { CONVERSATION } from "./desk.fixtures"
import { ID_MAX, TEXT_MAX } from "./desk-shapes"
import { webdeskText } from "../../modules/webdesk/copy"

/**
 * The conversation to answer in and the words an earlier step wrote; either may read nothing (a ticket with no conversation gets no
 * customer words from the plan), and then nothing is sent.
 */
export interface CustomerReplyInput {
    /** The conversation to reply in; null when none. */
    readonly conversationId?: string | null | undefined
    /** The reply text to send; null when none. */
    readonly text?: string | null | undefined
}

/** Whether the words went to the customer, whether a person declined the send, and the refusal when they did. */
export interface CustomerReplyOutput {
    /** True when the message was sent. */
    readonly sent: boolean
    /** True when a person declined the send (DECLINED rule 1): the graph tells the team and ends `declined`. */
    readonly declined: boolean
    /** Why the provider refused the call; null when it did not refuse. */
    readonly refusal: string | null
}

type NoParams = Record<string, never>

const params: z.ZodType<NoParams> = z.strictObject({})
const input: z.ZodType<CustomerReplyInput> = z.object({
    conversationId: z.string().min(1).max(ID_MAX).nullish(),
    text: z.string().min(1).max(TEXT_MAX).nullish(),
})
const output: z.ZodType<CustomerReplyOutput> = z.object({
    sent: z.boolean(),
    declined: z.boolean(),
    refusal: z.string().max(200).nullable(),
})

/** The refusal of a send a person said no to (TOOLS-LEAD ADDENDUM 2, 5): their decision, not an error. */
const DECLINED = "declined"

/** Nothing to send (no conversation, or no words). */
const NOT_SENT: CustomerReplyOutput = { sent: false, declined: false, refusal: null }

const REPLY =
    "Da ghi nhan yeu cau cua anh/chi voi ma phieu TK-0001. Ky thuat ben em dang kiem tra va se bao lai anh/chi ngay khi co ket qua."

/**
 * `webdesk.customer-reply` (Answer the customer): one customer send of the words the answer plan wrote (that a person is checking
 * the ticket, or the quote read from the price list), in the customer's conversation, through the conversation's own account.
 * Split from `webdesk.respond-told`. No AI call. The send runs by itself (`auto`); a person who declines it (a shop's own `ask`) decided so, and
 * the output says `declined` (the graph tells the team and ends `declined`: the reply is the ticket's business); any other refusal stops the step (it is the reply the customer is owed: the engine
 * reports it, no holding line here). With no conversation or no words there is nothing to send (exact checks).
 */
export const webdeskCustomerReplyNode: TemplateNode<
    z.ZodType<CustomerReplyInput>,
    z.ZodType<CustomerReplyOutput>,
    z.ZodType<NoParams>
> = defineTemplateNode({
    id: "webdesk.customer-reply",
    title: webdeskText("node.customer-reply.title"),
    description: { vi: "G\u1eedi kh\u00e1ch tin tr\u1ea3 l\u1eddi v\u1ec1 y\u00eau c\u1ea7u c\u1ee7a h\u1ecd.", en: "Sends the customer the reply to their request." },
    tools: [TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    params,
    input,
    output,
    sensitive: { text: "pii" },
    run: async (given, context) => {
        if (given.conversationId === null || given.conversationId === undefined) return NOT_SENT
        if (given.text === null || given.text === undefined) return NOT_SENT
        const said = await sayToCustomer(context, { text: given.text })
        if (said.ok) return { sent: true, declined: false, refusal: null }
        if (said.declined) return { sent: false, declined: true, refusal: DECLINED }
        return context.fail({ kind: "cannot", why: `customer_send_refused:${said.refusal}` }, said.facts)
    },
    examples: [
        {
            name: "sends the customer the words the plan wrote",
            params: {},
            input: { conversationId: CONVERSATION, text: REPLY },
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { text: REPLY },
                    answer: sentAnswer("z-1", CONVERSATION, "zalo"),
                },
            ],
            output: { sent: true, declined: false, refusal: null },
        },
        {
            name: "a refused send stops the step",
            params: {},
            input: { conversationId: CONVERSATION, text: REPLY },
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { text: REPLY },
                    answer: refused("outside_window"),
                },
            ],
            failure: { kind: "cannot", why: "customer_send_refused:outside_window" },
        },
        {
            name: "a person declines the send: their decision is returned for the graph to route",
            params: {},
            input: { conversationId: CONVERSATION, text: REPLY },
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { text: REPLY },
                    answer: refused(DECLINED),
                },
            ],
            output: { sent: false, declined: true, refusal: DECLINED },
        },
        {
            name: "a ticket with no conversation: nothing is sent",
            params: {},
            input: { conversationId: null, text: null },
            output: NOT_SENT,
        },
    ],
})
