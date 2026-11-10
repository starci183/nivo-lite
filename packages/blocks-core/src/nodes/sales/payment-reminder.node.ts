import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { RightsGrant } from "@nivo-lite/agent-sdk/rights"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import { TOOL } from "../../vocabulary/tool-ids"
import { itemsTextOf, orderLinesOf } from "../payment/payment-request.policy"
import { nodeGoalOf } from "../node-ui"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { CARE_RIGHTS, careFactsOfLead, careLeadOf, careOrderOf } from "./care.data"
import { paymentStateOf } from "./care.policy"
import { CARE_VOICE, agentAnswer } from "./care.steps"

const ID = "sales.payment-reminder"

/** What the reminder is given: the order the 2-hour timer woke for, and the language. */
export interface PaymentReminderInput {
    /** The order still waiting for payment (`= trigger.ref`). */
    readonly orderId: string
    /** The language of the message. */
    readonly locale: NodeLocale
}

/** What the reminder did. */
export interface PaymentReminderOutput {
    /** The order, echoed. */
    readonly orderId: string
    /** `reminded` the reminder went out; `settled` nothing to remind (paid, cancelled, gone, or the customer opted out). */
    readonly result: "reminded" | "settled"
}

const params: z.ZodObject<Record<string, never>> = z.object({})

const input: NodeSchema<PaymentReminderInput> = z.object({
    orderId: z.string().max(MAX_ID).min(1),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<PaymentReminderOutput> = z.object({
    orderId: z.string().max(MAX_ID).describe("The id of the order, as given."),
    result: z
        .enum(["reminded", "settled"])
        .describe("`reminded` when the reminder was sent to the customer (the agent answers only this)."),
})

const GUIDANCE =
    "The order was sent its bank details and QR a while ago and is not paid yet. Send ONE friendly reminder: name the order number and say " +
    "the transfer details are in the message above. Never pressure, never threaten to cancel. Send it with `customer.leadId` (the tool finds their conversation)."

const EXAMPLE_GRANT: RightsGrant = {
    rights: [...CARE_RIGHTS, { kind: "message", access: "write", scope: "turn", fields: ["body"] }],
}

const OPEN_ORDER = {
    id: "o1",
    orderNo: "DH-1",
    amountVnd: 300_000,
    status: "confirmed",
    items: { lines: [{ name: "tea boxes", qty: 2, unitVnd: 150_000, amountVnd: 300_000 }] },
    leadId: "l1",
    shippedAt: null,
}

const STORE = {
    order: [OPEN_ORDER],
    "sales-lead": [{ id: "l1", contactName: "An" }],
}

const REMINDER = "Shop nhắc nhẹ chị An: đơn DH-1 vẫn đang chờ thanh toán ạ, thông tin chuyển khoản ở tin nhắn phía trên."

/**
 * `sales.payment-reminder` (Nhắc khách chuyển khoản): two hours after the QR went out (the timer `payment.qr.create` armed), the agent
 * sends the customer ONE friendly reminder (`customer.message.send`). An order already paid, cancelled or gone, and a customer who asked to be left
 * alone, get nothing: a guard in code before the agent.
 */
export const salesPaymentReminderNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: ID,
    role: "output",
    title: bilingualOf("nodeSalesPaymentReminderTitle"),
    params,
    input,
    output,
    rights: CARE_RIGHTS,
    effects: [TOOL.customerMessageSend],
    requires: [TOOL.customerMessageSend],
    run: async (given, context) => {
        const settled: PaymentReminderOutput = { orderId: given.orderId, result: "settled" }
        const order = await careOrderOf(context, given.orderId)
        if (order === undefined || paymentStateOf(order.status) !== "open") return settled
        const lead = await careLeadOf(context, order.leadId)
        if ((await careFactsOfLead(context, order.leadId)).optedOut) return settled
        return agentAnswer(context, {
            goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE} ${CARE_VOICE}`,
            input: {
                locale: given.locale,
                order: { orderId: order.id, orderNo: order.orderNo, items: itemsTextOf(orderLinesOf(order.items)) },
                customer: lead === undefined ? null : { leadId: lead.id, name: lead.contactName },
                careKind: "payment-reminder",
            },
            output,
            maxTurns: 3,
            purpose: "payment-reminder",
        })
    },
    examples: [
        {
            name: "two hours after the QR the agent sends one friendly reminder",
            params: {},
            input: { orderId: "o1", locale: "vi" },
            output: { orderId: "o1", result: "reminded" },
            grant: EXAMPLE_GRANT,
            model: [
                {
                    call: {
                        tool: TOOL.customerMessageSend,
                        args: { leadId: "l1", text: REMINDER },
                    },
                },
                { done: { orderId: "o1", result: "reminded" } },
            ],
            effects: [
                { kind: TOOL.customerMessageSend, payload: { leadId: "l1", text: REMINDER } },
            ],
            store: STORE,
        },
        {
            name: "an order paid in the meantime gets no reminder",
            params: {},
            input: { orderId: "o1", locale: "vi" },
            output: { orderId: "o1", result: "settled" },
            grant: EXAMPLE_GRANT,
            effects: [],
            store: { ...STORE, order: [{ ...OPEN_ORDER, status: "paid" }] },
        },
    ],
})
