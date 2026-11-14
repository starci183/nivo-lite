import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { bilingualOf } from "../../../shared/messages/catalog"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused } from "../../../shared/nodes/tool-answers"
import { orderRecordAnswerOf, readOrder } from "./sales-order"
import { SALES_ORDER_ENTITY } from "../../../shared/entities/sales-entity-names"


/** The order to read. */
export interface OrderReadInput {
    /** The order, by its record id (a timer's `ref`, the order a cancel names); null only when the graph is wired wrongly. */
    readonly orderId: string | null
}

/** The order as the steps after it compare it: exactly, by an `ifNode`. */
export interface OrderReadOutput {
    /** The order. */
    readonly orderId: string
    /** Its code. */
    readonly orderNo: string
    /** Where it stands (`confirmed` and `invoiced` wait for money). */
    readonly status: string
    /** Its total, VND, or null when the record keeps none. */
    readonly amountVnd: number | null
    /** Its customer, or null. */
    readonly contactId: string | null
}

const input: NodeSchema<OrderReadInput> = z.object({ orderId: z.string().min(1).max(MAX_ID).nullable() })

const output: NodeSchema<OrderReadOutput> = z.object({
    orderId: z.string().min(1).max(MAX_ID).describe("The order."),
    orderNo: z.string().min(1).max(MAX_ID).describe("The order's code."),
    status: z.string().min(1).max(MAX_LINE).describe("Where the order stands."),
    amountVnd: z.number().int().min(0).nullable().describe("The order's total in VND, or null."),
    contactId: z.string().min(1).max(MAX_ID).nullable().describe("The order's customer, or null."),
})

/**
 * `sales.order-read` (Doc don hang): reads one `blocks-core.sales.order` record by id (`nivo.tool.record.get`) and hands its code, status, total and
 * customer to the steps after it; whether the order still waits for its money is the graph's `ifNode` on the status, exactly. Plain
 * logic: it decides nothing. An order the record tool does not find stops the run with the refusal.
 */
export const salesOrderReadNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.order-read",
    title: bilingualOf("nodeSalesOrderReadTitle"),
    description: { vi: "\u0110\u1ecdc m\u1ed9t \u0111\u01a1n h\u00e0ng: m\u00e3, tr\u1ea1ng th\u00e1i, t\u1ed5ng ti\u1ec1n v\u00e0 kh\u00e1ch c\u1ee7a \u0111\u01a1n.", en: "Reads one order: its code, status, total and customer." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    run: async (given, context) => {
        if (given.orderId === null) return context.fail({ kind: "cannot", why: "the order read was reached with no order named" })
        const order = await readOrder(context, given.orderId)
        return { orderId: order.id, orderNo: order.orderNo, status: order.status, amountVnd: order.amountVnd, contactId: order.contactId }
    },
    examples: [
        {
            name: "an order is read by its id: its code, status, total and customer",
            params: {},
            input: { orderId: "o1" },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: SALES_ORDER_ENTITY, id: "o1" },
                    answer: answered(
                        orderRecordAnswerOf("o1", {
                            orderNo: "DH-20261113-0001",
                            status: "confirmed",
                            amountVnd: 4500,
                            contactId: "contact-1",
                        }),
                    ),
                },
            ],
            output: { orderId: "o1", orderNo: "DH-20261113-0001", status: "confirmed", amountVnd: 4500, contactId: "contact-1" },
        },
        {
            name: "an order the record tool does not find stops the run with the refusal",
            params: {},
            input: { orderId: "o9" },
            tools: [{ id: TOOL.recordGet, args: { type: SALES_ORDER_ENTITY, id: "o9" }, answer: refused("not_found") }],
            failure: { kind: "cannot", why: `${TOOL.recordGet} refused: not_found` },
        },
        {
            name: "reached with no order named (a wiring fault): nothing is read",
            params: {},
            input: { orderId: null },
            failure: { kind: "cannot", why: "the order read was reached with no order named" },
        },
    ],
})
