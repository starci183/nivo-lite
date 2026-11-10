import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import { TOOL } from "../../vocabulary/tool-ids"
import { exampleGrantOf } from "../sales/consult.grant"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { nodeGoalOf } from "../node-ui"

/** The confirmed order to be paid, and the conversation the customer is in. */
export interface PaymentRequestInput {
    /** The order. */
    readonly orderId: string
    /** The conversation the customer is in. */
    readonly conversationId: string
    /** The language the shop writes in. */
    readonly locale: NodeLocale
}

/** What came of the request. */
export interface PaymentRequestOutput {
    /** The order, echoed for the steps that follow. */
    readonly orderId: string
    /** True when the QR and the transfer details reached the customer. */
    readonly sent: boolean
}

/** The id of the step, which names its goal in the messages catalog. */
const ID = "payment.request"

const params: z.ZodObject<Record<string, never>> = z.object({})

const input: NodeSchema<PaymentRequestInput> = z.object({
    orderId: z.string().min(1).max(MAX_ID),
    conversationId: z.string().min(1).max(MAX_ID),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<PaymentRequestOutput> = z.object({
    orderId: z.string().min(1).max(MAX_ID).describe("The order the QR was sent for, as given"),
    sent: z.boolean().describe(`True when ${TOOL.paymentQrCreate} answered that the QR and transfer details were sent`),
})

/** How the agent of the step behaves: the guidance of the goal, never a line it must say. */
const GUIDANCE = [
    `Call ${TOOL.paymentQrCreate} with \`orderId\` only: the tool reads the amount and the order number and sends the customer the ` +
        "bank details, the QR and the order card. You type no amount, account or transfer content.",
    `Once the QR is sent, arm the two payment follow-ups of the order with ${TOOL.careSchedule} (\`ref\` = the order id): ` +
        "`kind` `payment-reminder` after the policy's `paymentReminderHours`, and `kind` `payment-stale` after its " +
        "`paymentStaleHours`, each as `afterHours`; never type an instant. Arming again only moves the same timer.",
    "A refusal is a fact (no payment account connected, the order cannot be paid yet). Then tell the customer in one short holding " +
        `message (${TOOL.customerMessageSend}, in their language) that the shop will send the payment details shortly, and answer ` +
        "`confused` with the refusal as the reason, so the team is told. Never confirm a payment.",
].join("\n")

/** The effects the agent of the step may call: its whole reach. */
const EFFECTS = [TOOL.paymentQrCreate, TOOL.careSchedule, TOOL.customerMessageSend]

const GRANT = exampleGrantOf([], EFFECTS)

/**
 * `payment.request` (Gửi QR thanh toán): an Agent + MCP step that sends the customer the payment QR of a confirmed order, then arms the
 * payment reminder and the stale check at the hours of the Sales policy (`paymentReminderHours`, `paymentStaleHours`). The agent calls
 * the QR tool with the order id alone; everything with money in it (the amount, the account, the transfer content, the QR) is inside the
 * tool; when to follow up is the shop's policy, armed by the step, not by the tool. A refusal (no bank connected, an order not payable) is a fact the agent answers with a holding line and its
 * confusion, so the step is not done (`requires`), the team is told on /chat and the workflow waits; no branch is drawn for it.
 */
export const paymentRequestNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: ID,
    role: "output",
    title: bilingualOf("nodePaymentRequestTitle"),
    params,
    input,
    output,
    rights: [],
    effects: EFFECTS,
    requires: [TOOL.paymentQrCreate],
    run: async (given, context) => {
        const decision = await context.agent.run({
            goal: `${nodeGoalOf(ID, "en")}\n${GUIDANCE}`,
            purpose: "send-qr",
            input: given,
            output,
            maxTurns: 6,
        })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        return decision.value
    },
    examples: [
        {
            name: "sends the QR of the confirmed order through the QR tool, by its id alone",
            params: {},
            grant: GRANT,
            input: { orderId: "order-1", conversationId: "conv-1", locale: "vi" },
            output: { orderId: "order-1", sent: true },
            effects: [
                { kind: TOOL.paymentQrCreate, payload: { orderId: "order-1" } },
                { kind: TOOL.careSchedule, payload: { kind: "payment-reminder", ref: "order-1", afterHours: 2 } },
                { kind: TOOL.careSchedule, payload: { kind: "payment-stale", ref: "order-1", afterHours: 24 } },
            ],
            model: [
                { call: { tool: TOOL.paymentQrCreate, args: { orderId: "order-1" } } },
                { call: { tool: TOOL.careSchedule, args: { kind: "payment-reminder", ref: "order-1", afterHours: 2 } } },
                { call: { tool: TOOL.careSchedule, args: { kind: "payment-stale", ref: "order-1", afterHours: 24 } } },
                { done: { orderId: "order-1", sent: true } },
            ],
            answers: {
                [TOOL.paymentQrCreate]: [
                    {
                        kind: "message",
                        id: "msg-1",
                        facts: {
                            orderNo: "DH-1",
                            amountVnd: 4000,
                            transferContent: "DH1",
                            qrUrl: "https://qr.example/DH1.png",
                        },
                    },
                ],
                [TOOL.careSchedule]: [
                    { kind: "agent-task", id: "payment-reminder:order-1" },
                    { kind: "agent-task", id: "payment-stale:order-1" },
                ],
            },
        },
    ],
})
