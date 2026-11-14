import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"
import { answered, refused, valueOrCannot } from "../tool-answers"
import { orderOfAnswer, orderRecordAnswerOf } from "./sales-order"
import { SALES_ORDER_ENTITY } from "../../entities/sales/sales-entity-names"

/** The order the graph matched to a credit, exactly. */
export interface OrderPaidInput {
    /** The order. */
    readonly orderId: string
}

/** The order now recorded paid. */
export interface OrderPaidOutput {
    /** The order. */
    readonly orderId: string
    /** Its code; null when a person declined recording it paid (the tool answered nothing). */
    readonly orderNo: string | null
    /** Its customer, or null. */
    readonly contactId: string | null
    /** True when a person declined recording the order paid on its card: the order stays unpaid; the graph routes on it. */
    readonly declined: boolean
}

const input: NodeSchema<OrderPaidInput> = z.object({ orderId: z.string().min(1).max(MAX_ID) })

const output: NodeSchema<OrderPaidOutput> = z.object({
    orderId: z.string().min(1).max(MAX_ID).describe("The order now recorded paid."),
    orderNo: z.string().min(1).max(MAX_ID).nullable().describe("Its code; null when the write was declined."),
    contactId: z.string().min(1).max(MAX_ID).nullable().describe("Its customer, or null."),
    declined: z.boolean().describe("True when a person declined recording the order paid on its card: the order stays unpaid."),
})

/** The record update that records one order paid. */
const PAID_OF = (orderId: string) => ({ type: SALES_ORDER_ENTITY, id: orderId, patch: { status: "paid" } })

/**
 * `sales.order-paid` (Ghi don da tra): records the order paid (`nivo.tool.record.update` on the `blocks-core.sales.order` record, status `paid`) once
 * the graph's own expressions matched a credit to it exactly (its content contains the order's code AND its amount equals the order's
 * total). A plain tool call: the match was the graph's, nothing is decided here. A person declining the write on its card (mode `ask`) is a business outcome: `declined: true`, the order stays
 * unpaid, the graph routes on it. Any other refusal of the record tool stops the run with it.
 */
export const salesOrderPaidNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.order-paid",
    title: bilingualOf("nodeSalesOrderPaidTitle"),
    description: { vi: "Ghi \u0111\u01a1n l\u00e0 \u0111\u00e3 thanh to\u00e1n khi kho\u1ea3n ti\u1ec1n v\u1ec1 kh\u1edbp m\u00e3 \u0111\u01a1n v\u00e0 s\u1ed1 ti\u1ec1n.", en: "Marks the order as paid once an incoming payment matches its code and amount." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    run: async (given, context) => {
        const paidCall = await context.tools.call(TOOL.recordUpdate, PAID_OF(given.orderId))
        if (!paidCall.ok && paidCall.declined === true)
            return { orderId: given.orderId, orderNo: null, contactId: null, declined: true }
        const order = orderOfAnswer(
            context,
            TOOL.recordUpdate,
            valueOrCannot(context, TOOL.recordUpdate, paidCall),
        )
        return { orderId: order.id, orderNo: order.orderNo, contactId: order.contactId, declined: false }
    },
    examples: [
        {
            name: "the matched order is recorded paid",
            params: {},
            input: { orderId: "o1" },
            tools: [
                {
                    id: TOOL.recordUpdate,
                    args: PAID_OF("o1"),
                    answer: answered(
                        orderRecordAnswerOf("o1", {
                            orderNo: "DH-20261113-0001",
                            status: "paid",
                            amountVnd: 4500,
                            contactId: "contact-1",
                        }),
                    ),
                },
            ],
            output: { orderId: "o1", orderNo: "DH-20261113-0001", contactId: "contact-1", declined: false },
        },
        {
            name: "a person declines recording the order paid: the order stays unpaid and the node says declined",
            params: {},
            input: { orderId: "o1" },
            tools: [{ id: TOOL.recordUpdate, args: PAID_OF("o1"), answer: refused("declined") }],
            output: { orderId: "o1", orderNo: null, contactId: null, declined: true },
        },
        {
            name: "an update the record tool refuses stops the run with the refusal",
            params: {},
            input: { orderId: "o1" },
            tools: [{ id: TOOL.recordUpdate, args: PAID_OF("o1"), answer: refused("stale") }],
            failure: { kind: "cannot", why: `${TOOL.recordUpdate} refused: stale` },
        },
    ],
})
