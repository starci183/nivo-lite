import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../../shared/bounds"
import { bilingualOf } from "../../../shared/messages/catalog"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { frontDeskSample } from "../../../shared/customer-chat/front-desk.copy"
import { sayToCustomer, saidOrCannot } from "../../../shared/customer-chat/say-to-customer"
import { answered, refused } from "../../../shared/nodes/tool-answers"
import {
    HOURS_PASSAGE,
    PASSAGE_HIT,
    PASSAGE_MISS,
    PASSAGE_READ,
    SEARCH_MISS,
    chatSend,
    threadRead,
} from "../../../shared/customer-chat/front-desk.fixtures"
import { ANSWER_GOAL } from "../../../shared/customer-chat/front-desk.policy"
import { threadOf } from "../../../shared/customer-chat/front-desk.reads"

type NoParams = Record<string, never>

/** What the answer is written for. */
export interface AnswerInput {
    /** The conversation the question came in: the send answers there. */
    readonly conversationId: string
    /** What the customer said, one message per line. */
    readonly text: string
    /** The chat's window on the route's lines (`chatbot.hear`'s `startedAt`): the thread is read from then on; null: the whole route. */
    readonly since?: string | null | undefined
}

/** What the step answered. */
export interface AnswerOutput {
    /** The words written for the customer: sent, unless a person declined the send. */
    readonly reply: string
    /** True when a person declined the send on its card (a graph that narrows the send to `ask`): nothing was sent. */
    readonly declined: boolean
}

/** What the agent writes: the one message. */
interface AnswerWritten {
    readonly reply: string
}

const TEXT_MAX = 8000
/** The most turns the agent takes: the truth search, a document search, a second search with other words, the read, the answer, one more. */
const MAX_TURNS = 6

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<AnswerInput> = z.object({
    conversationId: z.string().min(1).max(MAX_ID),
    text: z.string().max(TEXT_MAX),
    since: z.string().max(40).nullish(),
})
const written: NodeSchema<AnswerWritten> = z.object({
    reply: z.string().min(1).max(MAX_BODY).describe("The one chat message for the customer; the step sends it"),
})
const output: NodeSchema<AnswerOutput> = z.object({
    reply: z
        .string()
        .min(1)
        .max(MAX_BODY)
        .describe("The one chat message for the customer: sent, unless a person declined it"),
    declined: z
        .boolean()
        .describe(
            "True when a person declined the send on its card: their decision, nothing sent; the graph routes on it.",
        ),
})

const CONFUSED_QUESTION = frontDeskSample("confusedQuestion")

/**
 * `chatbot.answer` (the front desk's "ask for information" route): an agent step. The step reads the recent conversation; the agent
 * searches the shop's truths and, when no truth answers, its documents (it writes the query; the conversation fixes the lens, so only
 * public truths and released public passages come back), and writes one message; the step sends it once through the customer send. A
 * greeting or small talk is answered here too. When the search does not answer, the agent is confused and the step sends nothing: no
 * holding line (decision D2), the engine's unhandled-case report owns what the customer hears. A graph that narrows the send to `ask`
 * (or an owner who sets it) lets a person decline it: a decision, never a failure, so the step returns `declined: true` (the words kept,
 * nothing sent) and the graph routes it to the team notice and the outcome `declined`.
 */
export const chatbotAnswerNode: TemplateNode<
    NodeSchema<AnswerInput>,
    NodeSchema<AnswerOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "chatbot.answer",
    title: bilingualOf("nodeChatbotAnswerTitle"),
    description: { vi: "T\u00ecm c\u00e2u tr\u1ea3 l\u1eddi trong th\u00f4ng tin c\u1ee7a c\u1eeda h\u00e0ng r\u1ed3i nh\u1eafn l\u1ea1i cho kh\u00e1ch. Kh\u00f4ng c\u00f3 th\u00f4ng tin ph\u00f9 h\u1ee3p th\u00ec kh\u00f4ng g\u1eedi g\u00ec.", en: "Looks for the answer in the shop's information and replies to the customer. If nothing fits, nothing is sent." },
    tools: [TOOL.conversationMessageList, TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const conversation = await threadOf(context, { since: given.since })
        const { reply } = await context.agent.run({
            goal: ANSWER_GOAL,
            input: { message: given.text, conversation: [...conversation] },
            output: written,
            // The truth search and the documents (found, then read whole) are the SDK default reads of every AI step: no subset names them.
            tools: [],
            maxTurns: MAX_TURNS,
        })
        const said = await sayToCustomer(
            context,
            { text: reply },
            { chat: { conversationId: given.conversationId } },
        )
        if (!said.ok && said.declined) return { reply, declined: true }
        saidOrCannot(context, said)
        return { reply, declined: false }
    },
    examples: [
        {
            name: "no truth answers: finds the public document, reads the passage, then answers the customer from it",
            params: {},
            input: { conversationId: "c1", text: frontDeskSample("gioMoCua") },
            tools: [threadRead([]), ...chatSend(frontDeskSample("faqReply"))],
            agent: [
                {
                    answer: { reply: frontDeskSample("faqReply") },
                    calls: [
                        {
                            id: TOOL.brainSearch,
                            args: { query: frontDeskSample("gioMoCua") },
                            answer: answered(SEARCH_MISS),
                        },
                        {
                            id: TOOL.brainPassageSearch,
                            args: { query: frontDeskSample("gioMoCua") },
                            answer: answered(PASSAGE_HIT),
                        },
                        { id: TOOL.brainPassageRead, args: { id: HOURS_PASSAGE }, answer: answered(PASSAGE_READ) },
                    ],
                },
            ],
            output: { reply: frontDeskSample("faqReply"), declined: false },
        },
        {
            name: "greets back and asks what the customer needs, with no document",
            params: {},
            input: { conversationId: "c1", text: frontDeskSample("chaoShop") },
            tools: [threadRead([]), ...chatSend(frontDeskSample("greetReply"))],
            agent: [{ answer: { reply: frontDeskSample("greetReply") } }],
            output: { reply: frontDeskSample("greetReply"), declined: false },
        },
        {
            name: "a question the search does not answer goes to the engine confused, and nothing is sent",
            params: {},
            input: { conversationId: "c1", text: frontDeskSample("unanswered") },
            tools: [threadRead([])],
            agent: [
                {
                    fail: { kind: "confused", question: CONFUSED_QUESTION },
                    // The searches the agent made before it gave up: no truth, no document answers.
                    calls: [
                        {
                            id: TOOL.brainSearch,
                            args: { query: frontDeskSample("unanswered") },
                            answer: answered(SEARCH_MISS),
                        },
                        {
                            id: TOOL.brainPassageSearch,
                            args: { query: frontDeskSample("unanswered") },
                            answer: answered(PASSAGE_MISS),
                        },
                    ],
                },
            ],
            failure: { kind: "confused", question: CONFUSED_QUESTION },
        },
        {
            // A graph that narrows the send to `ask` (`CUSTOMER_SEND_ASK`): the owner said no on the card.
            name: "the owner declines the answer on its card: their decision, nothing is sent and the step returns declined",
            params: {},
            input: { conversationId: "c1", text: frontDeskSample("chaoShop") },
            tools: [
                threadRead([]),
                {
                    id: TOOL.customerMessageSend,
                    args: { text: frontDeskSample("greetReply") },
                    answer: refused("declined"),
                },
            ],
            agent: [{ answer: { reply: frontDeskSample("greetReply") } }],
            output: { reply: frontDeskSample("greetReply"), declined: true },
        },
    ],
})
