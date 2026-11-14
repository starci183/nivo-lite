import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../../shared/bounds"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { frontDeskSample } from "../../../shared/customer-chat/front-desk.copy"
import { sayToCustomer, saidOrCannot } from "../../../shared/customer-chat/say-to-customer"
import { refused } from "../../../shared/nodes/tool-answers"
import { COMPLAINT_THREAD, chatSend, lastOrderRead, threadRead } from "../../../shared/customer-chat/front-desk.fixtures"
import { COMPLAINT_REPLY_GOAL } from "../../../shared/customer-chat/front-desk.policy"
import { lastOrderCodeOf, threadOf } from "../../../shared/customer-chat/front-desk.reads"
import { bilingualOf } from "../../../shared/messages/catalog"

type NoParams = Record<string, never>

/** What the complaint reply is written from. */
export interface ComplaintReplyInput {
    /** The conversation the complaint came in: the send answers there. */
    readonly conversationId: string
    /** What the customer said, one message per line. */
    readonly text: string
    /** The one line the front desk's decision wrote, or null when it is not bound. */
    readonly summary?: string | null | undefined
    /** The chat's window on the route's lines (`chatbot.hear`'s `startedAt`): the thread is read from then on; null: the whole route. */
    readonly since?: string | null | undefined
}

/** What the agent writes: the words for the customer, and what the team's notice is built from. */
interface ComplaintReplyWritten {
    /** The words for the customer. */
    readonly reply: string
    /** The order the complaint is about, when the customer named it or the thread shows it; null when still unknown. */
    readonly orderCode: string | null
    /** One line in Vietnamese for the team: who complains about what, and the order if known. */
    readonly summary: string
}

/** What the step did: the words (sent unless declined), what the team's notice is built from, and whether a person declined the send. */
export interface ComplaintReplyOutput extends ComplaintReplyWritten {
    /** True when a person declined the send on its card (a graph that narrows the send to `ask`): nothing was sent. */
    readonly declined: boolean
}

const TEXT_MAX = 8000

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<ComplaintReplyInput> = z.object({
    conversationId: z.string().min(1).max(MAX_ID),
    text: z.string().max(TEXT_MAX),
    summary: z.string().max(MAX_LINE).nullish(),
    since: z.string().max(40).nullish(),
})
const writtenFields = {
    reply: z.string().min(1).max(MAX_BODY).describe("The one chat message for the customer; the step sends it"),
    orderCode: z
        .string()
        .min(1)
        .max(MAX_ID)
        .nullable()
        .describe("The order the complaint is about when the customer named it or the thread shows it, else null"),
    summary: z
        .string()
        .min(1)
        .max(MAX_LINE)
        .describe("One line in Vietnamese for the team: who complains about what, and the order if known"),
}
const written: NodeSchema<ComplaintReplyWritten> = z.object(writtenFields)
const output: NodeSchema<ComplaintReplyOutput> = z.object({
    ...writtenFields,
    declined: z
        .boolean()
        .describe(
            "True when a person declined the send on its card: their decision, nothing sent; the graph routes on it.",
        ),
})

/**
 * `chatbot.complaint-reply` (the front desk answers a complaint): an agent step. The step reads the thread and the customer's last
 * order; the agent writes one apology that promises nothing only a person may decide, asking at most for the one fact still missing,
 * and names the order when it is known; the step sends it once. The team is told by the next step, `chatbot.complaint-notify`. When
 * the agent cannot, it is confused and the engine takes over. A graph that narrows the send to `ask` (or an owner who sets it) lets a
 * person decline it: a decision, never a failure, so the step returns `declined: true` (the words and the summary kept, nothing sent)
 * and the graph routes it to the team notice and the outcome `declined`.
 */
export const chatbotComplaintReplyNode: TemplateNode<
    NodeSchema<ComplaintReplyInput>,
    NodeSchema<ComplaintReplyOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "chatbot.complaint-reply",
    title: bilingualOf("nodeChatbotComplaintReplyTitle"),
    description: { vi: "Nh\u1eafn kh\u00e1ch m\u1ed9t l\u1eddi xin l\u1ed7i, kh\u00f4ng h\u1ee9a \u0111i\u1ec1u ch\u1ec9 ng\u01b0\u1eddi th\u1eadt m\u1edbi quy\u1ebft \u0111\u1ecbnh \u0111\u01b0\u1ee3c, v\u00e0 h\u1ecfi th\u00eam n\u1ebfu c\u00f2n thi\u1ebfu th\u00f4ng tin.", en: "Sends the customer an apology that promises nothing only a person can decide, and asks for what is still missing." },
    tools: [TOOL.conversationMessageList, TOOL.leadOrderList, TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const conversation = await threadOf(context, { since: given.since })
        const lastOrderCode = await lastOrderCodeOf(context)
        const draft = await context.agent.run({
            goal: COMPLAINT_REPLY_GOAL,
            input: {
                message: given.text,
                conversation: [...conversation],
                known: { summary: given.summary ?? null, lastOrderCode },
            },
            output: written,
            tools: [],
            maxTurns: 1,
        })
        const said = await sayToCustomer(
            context,
            { text: draft.reply },
            { chat: { conversationId: given.conversationId } },
        )
        if (!said.ok && said.declined) return { ...draft, declined: true }
        saidOrCannot(context, said)
        return { ...draft, declined: false }
    },
    examples: [
        {
            name: "apologises and asks for the order it does not know",
            params: {},
            input: { conversationId: "c1", text: frontDeskSample("hoaHeo") },
            tools: [threadRead([]), lastOrderRead(null), ...chatSend(frontDeskSample("complaintReply"))],
            agent: [
                {
                    answer: {
                        reply: frontDeskSample("complaintReply"),
                        orderCode: null,
                        summary: frontDeskSample("summaryComplaintNoOrder"),
                    },
                },
            ],
            output: {
                reply: frontDeskSample("complaintReply"),
                orderCode: null,
                summary: frontDeskSample("summaryComplaintNoOrder"),
                declined: false,
            },
        },
        {
            name: "a bare order number after the shop asked for it completes the complaint: confirms, asks nothing, names the order",
            params: {},
            input: { conversationId: "c1", text: frontDeskSample("maDon") },
            tools: [
                threadRead(COMPLAINT_THREAD),
                lastOrderRead(null),
                ...chatSend(frontDeskSample("complaintDoneReply")),
            ],
            agent: [
                {
                    answer: {
                        reply: frontDeskSample("complaintDoneReply"),
                        orderCode: "DH-102",
                        summary: frontDeskSample("summaryComplaint"),
                    },
                },
            ],
            output: {
                reply: frontDeskSample("complaintDoneReply"),
                orderCode: "DH-102",
                summary: frontDeskSample("summaryComplaint"),
                declined: false,
            },
        },
        {
            // A graph that narrows the send to `ask` (`CUSTOMER_SEND_ASK`): the owner said no on the card.
            name: "the owner declines the complaint reply on its card: their decision, nothing is sent and the step returns declined",
            params: {},
            input: { conversationId: "c1", text: frontDeskSample("hoaHeo") },
            tools: [
                threadRead([]),
                lastOrderRead(null),
                {
                    id: TOOL.customerMessageSend,
                    args: { text: frontDeskSample("complaintReply") },
                    answer: refused("declined"),
                },
            ],
            agent: [
                {
                    answer: {
                        reply: frontDeskSample("complaintReply"),
                        orderCode: null,
                        summary: frontDeskSample("summaryComplaintNoOrder"),
                    },
                },
            ],
            output: {
                reply: frontDeskSample("complaintReply"),
                orderCode: null,
                summary: frontDeskSample("summaryComplaintNoOrder"),
                declined: true,
            },
        },
    ],
})
