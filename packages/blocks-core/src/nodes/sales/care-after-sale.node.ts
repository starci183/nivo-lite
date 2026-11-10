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
import { DELIVERY_CARE_RIGHTS, careDeliveryOf, careFactsOfLead, careLeadOf, careOrderOf } from "./care.data"
import { CARE_VOICE, agentAnswer } from "./care.steps"

const ID = "sales.after-sale"

/** What the thank-you is given: the paid order and the language. */
export interface AfterSaleInput {
    /** The order that was paid (`= trigger.orderId`). */
    readonly orderId: string
    /** The language of the message. */
    readonly locale: NodeLocale
}

/** What the thank-you did. */
export interface AfterSaleOutput {
    /** The order, echoed for the steps that follow. */
    readonly orderId: string
    /** True when the thank-you reached the customer. */
    readonly sent: boolean
}

const params: z.ZodObject<Record<string, never>> = z.object({})

const input: NodeSchema<AfterSaleInput> = z.object({
    orderId: z.string().max(MAX_ID).min(1),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<AfterSaleOutput> = z.object({
    orderId: z.string().max(MAX_ID).describe("The id of the paid order, as given."),
    sent: z.boolean().describe("True when the thank-you reached the customer; false when it was skipped or the customer opted out."),
})

const GUIDANCE =
    "Thank the customer for paying the order (name its order number), then confirm how it is delivered from `order.delivery`: the address, " +
    "the recipient and the day and time exactly as the order holds them. The order is the truth for this delivery; never name another " +
    "address, recipient or time (what the shop remembered of the customer from earlier orders does not count). Ask the customer for " +
    "nothing: when the order holds no time or no address, thank and say the shop will confirm it. After sending, set the customer's stage " +
    "to `after_sale`. Send to the customer by `customer.leadId` (the tool finds their conversation)."

const PAID_ORDER = {
    id: "o1",
    orderNo: "DH-1",
    amountVnd: 2000,
    status: "paid",
    items: { lines: [] },
    leadId: "l1",
    shippedAt: null,
    deliveryAddress: "25 Nguyễn Huệ",
    deliveryAt: "chiều mai",
    recipientName: null,
    recipientPhone: "0901 234 567",
    note: "",
}

const EXAMPLE_GRANT: RightsGrant = {
    rights: [
        ...DELIVERY_CARE_RIGHTS,
        { kind: "message", access: "write", scope: "turn", fields: ["body"] },
        { kind: "sales-lead", access: "write", scope: "turn", fields: ["consultStage", "consultFacts"] },
    ],
}

const THANKS = "Shop đã nhận tiền đơn DH-1, cảm ơn chị An nhiều! Đơn sẽ giao tới 25 Nguyễn Huệ vào chiều mai như chị dặn."

/**
 * `sales.after-sale` (Cảm ơn khách): once Đối soát marked the order paid, the agent thanks the customer and confirms the delivery address
 * and time the order holds and asks for nothing. A customer who asked to be left alone gets nothing (a guard in code). It reads the order
 * (its delivery fields are the truth for this delivery; what lead memory remembers from earlier consults is not handed over) and the
 * customer; it writes the message itself (`TOOL.customerMessageSend` by the customer's `leadId`: the tool finds their most recent
 * conversation) and moves the customer's stage to `after_sale` (`TOOL.leadUpdate`). The care that follows
 * (the check-in after delivery, the occasions) is armed by the next step, `sales.care-plan`.
 */
export const salesAfterSaleNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: ID,
    role: "output",
    title: bilingualOf("nodeSalesAfterSaleTitle"),
    params,
    input,
    output,
    rights: DELIVERY_CARE_RIGHTS,
    effects: [TOOL.customerMessageSend, TOOL.leadUpdate],
    requires: [TOOL.customerMessageSend],
    run: async (given, context) => {
        const order = await careOrderOf(context, given.orderId)
        const leadId = order?.leadId ?? null
        const lead = await careLeadOf(context, leadId)
        const facts = careFactsOfLead(lead)
        if (facts.optedOut) return { orderId: given.orderId, sent: false }
        const delivery = await careDeliveryOf(context, given.orderId)
        return agentAnswer(context, {
            goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE} ${CARE_VOICE}`,
            input: {
                locale: given.locale,
                order:
                    order === undefined
                        ? null
                        : {
                              orderId: order.id,
                              orderNo: order.orderNo,
                              status: order.status,
                              items: itemsTextOf(orderLinesOf(order.items)),
                              delivery,
                          },
                customer:
                    lead === undefined
                        ? null
                        : {
                              leadId: lead.id,
                              name: lead.contactName,
                          },
                careKind: "after-sale",
            },
            output,
            maxTurns: 4,
            purpose: "after-sale",
        })
    },
    examples: [
        {
            name: "thanks the customer, confirms the address and time the ORDER holds (not an older address memory remembers), and moves them to after-sale",
            params: {},
            input: { orderId: "o1", locale: "vi" },
            output: { orderId: "o1", sent: true },
            grant: EXAMPLE_GRANT,
            model: [
                {
                    call: {
                        tool: TOOL.customerMessageSend,
                        args: { leadId: "l1", text: THANKS },
                    },
                },
                { call: { tool: TOOL.leadUpdate, args: { leadId: "l1", consultStage: "after_sale" } } },
                { done: { orderId: "o1", sent: true } },
            ],
            effects: [
                { kind: TOOL.customerMessageSend, payload: { leadId: "l1", text: THANKS } },
                { kind: TOOL.leadUpdate, payload: { leadId: "l1", consultStage: "after_sale" } },
            ],
            store: {
                order: [PAID_ORDER],
                "sales-lead": [
                    { id: "l1", contactName: "An", consultFacts: { address: "57 Thạch Hãn", deliveryAt: "ngày mốt" } },
                ],
            },
        },
        {
            name: "thanks without asking when the order holds no time: the shop will confirm it, whatever memory remembers",
            params: {},
            input: { orderId: "o1", locale: "en" },
            output: { orderId: "o1", sent: true },
            grant: EXAMPLE_GRANT,
            model: [
                {
                    call: {
                        tool: TOOL.customerMessageSend,
                        args: {
                            leadId: "l1",
                            text: "We received the payment for order DH-1, thank you! The shop will confirm the delivery time with you.",
                        },
                    },
                },
                { done: { orderId: "o1", sent: true } },
            ],
            effects: [TOOL.customerMessageSend],
            store: {
                order: [{ ...PAID_ORDER, deliveryAt: null }],
                "sales-lead": [{ id: "l1", contactName: "An", consultFacts: { address: "25 Nguyễn Huệ", deliveryAt: "chiều mai" } }],
            },
        },
        {
            name: "a customer who asked to be left alone is not written to",
            params: {},
            input: { orderId: "o1", locale: "vi" },
            output: { orderId: "o1", sent: false },
            grant: EXAMPLE_GRANT,
            effects: [],
            store: {
                order: [PAID_ORDER],
                "sales-lead": [{ id: "l1", contactName: "An", consultFacts: { careOptOut: true } }],
            },
        },
    ],
})
