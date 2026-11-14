import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../../shared/bounds"
import { bilingualOf, messageOf } from "../../../shared/messages/catalog"
import type { NodeLocale, NodeSchema } from "../../../shared/nodes/node-schema.types"
import { sayToCustomer, saidOrCannot } from "../../../shared/customer-chat/say-to-customer"
import { threadLine, threadRead } from "../../../shared/customer-chat/front-desk.fixtures"
import { threadRowsOf, unreadPicturesOf, unreadTextOf } from "../../../shared/customer-chat/front-desk.reads"
import { refused, sentAnswer } from "../../../shared/nodes/tool-answers"
import { CARE_VOICE, careMessageSchema } from "./care.steps"

/** The customer's words that they paid, and their conversation. */
export interface PaidClaimReplyInput {
    /** The customer's conversation; null only when the graph is wired wrongly (a call names it). */
    readonly conversationId: string | null
    /**
     * The words the hand-off carried (the line that woke the run; empty for a picture-only line); null only when the graph is wired
     * wrongly. What the step answers is every line the customer wrote since the shop last spoke, read from the thread; these words stand
     * only when the thread holds none.
     */
    readonly text: string | null
    /** The language the shop writes in. */
    readonly locale: NodeLocale
}

const input: NodeSchema<PaidClaimReplyInput> = z.object({
    conversationId: z.string().min(1).max(MAX_ID).nullable(),
    text: z.string().max(MAX_BODY).nullable(),
    locale: z.enum(["vi", "en"]),
})

/** The most pictures of the customer one answer is shown (a transfer's screenshot is read as the customer's words are). */
const PICTURES_SHOWN_MAX = 4

/** What the step answers: the message it sent, or the declined form. */
export interface PaidClaimReplyOutput {
    /** The one message sent to the customer; null when a person declined the send. */
    readonly text: string | null
    /** True when a person declined the send on its card: the customer is left unanswered; the graph routes on it. */
    readonly declined: boolean
    /** What the customer said that the step answered (every unread line, one per line; empty for pictures only): what the team is told. */
    readonly heard: string
}

const output: NodeSchema<PaidClaimReplyOutput> = z.object({
    text: z.string().min(1).max(MAX_BODY).nullable().describe("The one message sent to the customer; null when the send was declined."),
    declined: z.boolean().describe("True when a person declined the send on its card: the customer got no answer."),
    heard: z.string().max(MAX_BODY).describe("What the customer said that the step answered: every unread line, one per line."),
})

/** What the agent writes: the one message the step sends. */
const written = careMessageSchema

/** How the agent of the step writes: the guidance of the goal, never a line it must say. */
const GUIDANCE = [
    "The customer says they paid. Answer in ONE short message, in `locale`: thank them and say the shop sees the payment once the bank " +
        "reports it and the team is told now. Never confirm that the money arrived, an order is paid, a refund or a delivery.",
    CARE_VOICE,
].join("\n")

/** The claim of the examples, as the customer wrote it. */
const CLAIM = "I transferred for DH-20261113-0001"

/** The thread of the examples: the shop's last line, then the claim (the conversation read answers newest first). */
const CLAIM_THREAD = threadRead([
    threadLine("agent", "We open at 8", "2026-11-13T08:00:00.000Z"),
    threadLine("user", CLAIM, "2026-11-13T09:00:00.000Z"),
])

/** The answer of the examples, as the agent writes it. */
const ANSWER = "Thank you! The shop sees your transfer as soon as the bank reports it; I have told the team."

/**
 * `sales.paid-claim-reply` (Tra loi khach bao da chuyen): answers a customer who says they paid, in their conversation, without confirming
 * anything: the money is settled when the bank's credit arrives (the payment graph's credit trigger), never on the customer's words. The
 * agent writes the line (no wording is coded); the step sends it once. A person declining the send on its card is a business outcome (`declined: true`,
 * the customer is left unanswered, the graph tells the team); any other refusal stops the run with it.
 */
export const salesPaidClaimReplyNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.paid-claim-reply",
    title: bilingualOf("nodeSalesPaidClaimReplyTitle"),
    description: { vi: "Tr\u1ea3 l\u1eddi kh\u00e1ch n\u00f3i \u0111\u00e3 chuy\u1ec3n ti\u1ec1n m\u00e0 ch\u01b0a x\u00e1c nh\u1eadn g\u00ec: shop s\u1ebd x\u00e1c nh\u1eadn khi ti\u1ec1n v\u1ec1 t\u00e0i kho\u1ea3n.", en: "Answers a customer who says they paid without confirming anything: the shop confirms once the money arrives." },
    tools: [TOOL.conversationMessageList, TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const { conversationId, text } = given
        if (conversationId === null || text === null)
            return context.fail({ kind: "cannot", why: "the answer was reached with no conversation or no words" })
        // What the person said is every line since the shop last spoke (the engine's thread of the run's route, pictures included), not
        // only the words the hand-off carried: lines said after the front desk heard them are answered too (R73).
        const rows = await threadRowsOf(context)
        const unread = unreadTextOf(rows)
        const heard = unread === "" ? text : unread
        const message = await context.agent.run({
            goal: `${messageOf("en", "nodeSalesPaidClaimReplyGoal")}\n${GUIDANCE}`,
            input: { text: heard, locale: given.locale },
            images: unreadPicturesOf(rows, PICTURES_SHOWN_MAX),
            output: written,
            tools: [],
            // One answer is the work; the second turn is there only for an answer the loop refused (no turn shape, an output that does not
            // fit): the model reads why and answers again, instead of the payment stopping confused on one slip (P-FIX2 list).
            maxTurns: 2,
        })
        const said = await sayToCustomer(context, { text: message.text })
        if (!said.ok && said.declined) return { text: null, declined: true, heard }
        saidOrCannot(context, said)
        return { text: message.text, declined: false, heard }
    },
    examples: [
        {
            name: "a customer who says they paid is thanked and told the shop sees it once the bank reports it; nothing is confirmed",
            params: {},
            input: { conversationId: "conv-1", text: "I transferred for DH-20261113-0001", locale: "en" },
            agent: [{ answer: { text: ANSWER } }],
            tools: [
                CLAIM_THREAD,
                {
                    id: TOOL.customerMessageSend,
                    args: { text: ANSWER },
                    answer: sentAnswer("msg-3", "conv-1"),
                },
            ],
            output: { text: ANSWER, declined: false, heard: CLAIM },
        },
        {
            name: "a person declines the send: the customer is left unanswered and the node says declined",
            params: {},
            input: { conversationId: "conv-1", text: "I transferred for DH-20261113-0001", locale: "en" },
            agent: [{ answer: { text: ANSWER } }],
            tools: [
                CLAIM_THREAD,
                {
                    id: TOOL.customerMessageSend,
                    args: { text: ANSWER },
                    answer: refused("declined"),
                },
            ],
            output: { text: null, declined: true, heard: CLAIM },
        },
        {
            name: "the lines said after the front desk heard the claim are answered too, once, and handed on for the team",
            params: {},
            input: { conversationId: "conv-1", text: "I transferred", locale: "en" },
            agent: [{ answer: { text: ANSWER } }],
            tools: [
                threadRead([
                    threadLine("agent", "We open at 8", "2026-11-13T08:00:00.000Z"),
                    threadLine("user", "I transferred", "2026-11-13T09:00:00.000Z"),
                    threadLine("user", "for DH-20261113-0001", "2026-11-13T09:00:05.000Z"),
                ]),
                { id: TOOL.customerMessageSend, args: { text: ANSWER }, answer: sentAnswer("msg-3", "conv-1") },
            ],
            output: { text: ANSWER, declined: false, heard: "I transferred\nfor DH-20261113-0001" },
        },
        {
            name: "a refused send stops the run with the refusal",
            params: {},
            input: { conversationId: "conv-1", text: "I transferred for DH-20261113-0001", locale: "en" },
            agent: [{ answer: { text: ANSWER } }],
            tools: [
                CLAIM_THREAD,
                {
                    id: TOOL.customerMessageSend,
                    args: { text: ANSWER },
                    answer: refused("outside_window"),
                },
            ],
            failure: { kind: "cannot", why: `${TOOL.customerMessageSend} refused: outside_window` },
        },
        {
            name: "reached with no conversation (a wiring fault: only a call with the conversation routes here): nothing is written or sent",
            params: {},
            input: { conversationId: null, text: null, locale: "en" },
            failure: { kind: "cannot", why: "the answer was reached with no conversation or no words" },
        },
    ],
})
