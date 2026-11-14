import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../bounds"
import { bilingualOf, messageOf } from "../../messages/catalog"
import { careMessageSchema } from "./care.steps"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { sayToCustomer, saidOrCannot } from "../say-to-customer"
import { refused, sentAnswer } from "../tool-answers"

/** The cancelled order and the conversation to tell the customer in. */
export interface OrderCancelTellInput {
    /** The customer's conversation. */
    readonly conversationId: string
    /** The number of the order the cancel step cancelled; null only when the cancel answered none (a declined cancel never routes here). */
    readonly orderNo: string | null
    /** The language the shop writes in. */
    readonly locale: NodeLocale
}

/** What the customer was told. */
export interface OrderCancelTellOutput {
    /** The words sent; null when a person declined the send. */
    readonly text: string | null
    /** True when a person declined the send on its card: the customer is not told the order is cancelled; the graph routes on it. */
    readonly declined: boolean
}

/** The id of the step. */
const ID = "sales.order-cancel-tell"

const input: NodeSchema<OrderCancelTellInput> = z.object({
    conversationId: z.string().min(1).max(MAX_ID),
    orderNo: z.string().min(1).max(MAX_ID).nullable(),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<OrderCancelTellOutput> = z.object({
    text: z.string().min(1).max(MAX_BODY).nullable().describe("The one message sent to the customer; null when the send was declined."),
    declined: z.boolean().describe("True when a person declined the send on its card: the customer was not told."),
})

/** What the agent writes: the one message the step sends. */
const written = careMessageSchema

/** How the agent of the step behaves: the guidance of the goal, never a line it must say. */
const GUIDANCE = [
    "Write ONE short message for the customer, in `locale`, that order `orderNo` is cancelled, and offer to help with anything else. The step sends it.",
    "The order IS cancelled: the step before you cancelled it and the tool answered so. Promise no refund, no new order and no date.",
].join("\n")

/** The line of the example, as the old consult example sent it. */
const CANCELLED_DH7 = "Order DH-7 is cancelled. Anything else I can help with?"

/**
 * `sales.order-cancel-tell` (Bao khach da huy don): tells the customer, in their conversation, that the order the cancel step cancelled is
 * cancelled. The agent writes the line (no tool); the step sends it once with `nivo.tool.customer.message.send`. Split from the cancel itself
 * so the customer hears it only after the tool answered (the founder may approve the cancel long after the turn), and so a failed message
 * re-runs without touching the order again. A person declining the send on its card is a business outcome (`declined: true`); any other
 * refused send stops the run with the refusal.
 */
export const salesOrderCancelTellNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: bilingualOf("nodeSalesOrderCancelTellTitle"),
    description: { vi: "B\u00e1o kh\u00e1ch \u0111\u01a1n c\u1ee7a h\u1ecd \u0111\u00e3 \u0111\u01b0\u1ee3c hu\u1ef7, sau khi vi\u1ec7c hu\u1ef7 \u0111\u00e3 th\u1ef1c hi\u1ec7n xong.", en: "Tells the customer their order has been cancelled, once the cancel is done." },
    tools: [TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const { orderNo } = given
        if (orderNo === null) return context.fail({ kind: "cannot", why: "no cancelled order to tell the customer of" })
        const message = await context.agent.run({
            goal: `${messageOf("en", "nodeSalesOrderCancelTellGoal")}\n${GUIDANCE}`,
            input: { conversationId: given.conversationId, orderNo, locale: given.locale },
            output: written,
            tools: [],
            maxTurns: 1,
        })
        const said = await sayToCustomer(context, { text: message.text })
        if (!said.ok && said.declined) return { text: null, declined: true }
        saidOrCannot(context, said)
        return { text: message.text, declined: false }
    },
    examples: [
        {
            name: "the customer is told order DH-7 is cancelled, only after the cancel step's tool answered",
            params: {},
            input: { conversationId: "conv-1", orderNo: "DH-7", locale: "en" },
            agent: [{ answer: { text: CANCELLED_DH7 } }],
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { text: CANCELLED_DH7 },
                    answer: sentAnswer("msg-2", "conv-1"),
                },
            ],
            output: { text: CANCELLED_DH7, declined: false },
        },
        {
            name: "a person declines the send: the customer is not told and the node says declined",
            params: {},
            input: { conversationId: "conv-1", orderNo: "DH-7", locale: "en" },
            agent: [{ answer: { text: CANCELLED_DH7 } }],
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { text: CANCELLED_DH7 },
                    answer: refused("declined"),
                },
            ],
            output: { text: null, declined: true },
        },
        {
            name: "a refused send stops the run with the refusal; the order stays cancelled",
            params: {},
            input: { conversationId: "conv-1", orderNo: "DH-7", locale: "en" },
            agent: [{ answer: { text: CANCELLED_DH7 } }],
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { text: CANCELLED_DH7 },
                    answer: refused("outside_window"),
                },
            ],
            failure: { kind: "cannot", why: `${TOOL.customerMessageSend} refused: outside_window` },
        },
        {
            name: "reached with no order number (a wiring fault: only a cancel that answered routes here): nothing is written or sent",
            params: {},
            input: { conversationId: "conv-1", orderNo: null, locale: "en" },
            failure: { kind: "cannot", why: "no cancelled order to tell the customer of" },
        },
    ],
})
