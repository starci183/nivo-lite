import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"
import { answered, refused, valueOrCannot } from "../tool-answers"
import { SALES_ORDER_ENTITY } from "../../entities/sales/sales-entity-names"

/** The order the consult was asked to cancel, and why. */
export interface OrderCancelInput {
    /** The order, by the id the consult took from the customer's own orders; null only when the graph is wired wrongly. */
    readonly orderId: string | null
    /** Why, in a few words (what the customer or the founder said), or null. */
    readonly reason: string | null
}

/** The order that is now cancelled, or that a person declined to cancel. */
export interface OrderCancelOutput {
    /** The order. */
    readonly orderId: string
    /** Its number, as the customer and the team see it; null when a person declined the cancel (the tool answered nothing). */
    readonly orderNo: string | null
    /** True when a person declined the cancel on its card: their decision, the order stays; the graph routes on it. */
    readonly declined: boolean
}

const input: NodeSchema<OrderCancelInput> = z.object({
    orderId: z.string().min(1).max(MAX_ID).nullable(),
    reason: z.string().min(1).max(MAX_LINE).nullable(),
})

const output: NodeSchema<OrderCancelOutput> = z.object({
    orderId: z.string().min(1).max(MAX_ID),
    orderNo: z
        .string()
        .min(1)
        .max(MAX_ID)
        .nullable()
        .describe("The cancelled order's number; null when the cancel was declined."),
    declined: z
        .boolean()
        .describe(
            "True when a person declined the cancel on its card: their decision, the order stays; the graph routes on it.",
        ),
})

/** The record update that cancels one order. */
const CANCEL_OF = (orderId: string) => ({ type: SALES_ORDER_ENTITY, id: orderId, patch: { status: "cancelled" } })

/** The shape of the order the record update answers: its number. */
const updatedShape = z.object({ record: z.object({ values: z.object({ orderNo: z.string().min(1).max(MAX_ID) }) }) })

/**
 * `sales.order-cancel` (Huy don): cancels one of the customer's orders the consult named, by writing its status `cancelled` through
 * `nivo.tool.record.update` on the declared `blocks-core.sales.order` record; the node declares `auto` (the graph reaches it only for an order
 * that is not paid: a customer cancelling their own unpaid order needs no approval). A plain tool call: which order and why were read by the consult. A refusal of the record
 * tool is a fact the node cannot work around, so the run stops with it; the customer is told only by the next step, and only once the
 * tool answered. A shop that sets the step to `ask` and declines it (`declined`) decided the order stays: a decision, never a failure, so the node
 * returns `declined: true` (no number: the tool answered none) and the graph routes it to the team notice and the outcome `declined`;
 * the customer is told nothing.
 */
export const salesOrderCancelNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.order-cancel",
    title: bilingualOf("nodeSalesOrderCancelTitle"),
    description: { vi: "Hu\u1ef7 \u0111\u01a1n ch\u01b0a thanh to\u00e1n c\u1ee7a kh\u00e1ch theo y\u00eau c\u1ea7u c\u1ee7a h\u1ecd. N\u1ebfu \u0111\u1ed9i t\u1eeb ch\u1ed1i th\u00ec \u0111\u01a1n \u0111\u01b0\u1ee3c gi\u1eef nguy\u00ean.", en: "Cancels the customer's unpaid order at their request. If the team declines, the order stays." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    run: async (given, context) => {
        const orderId = given.orderId
        if (orderId === null) return context.fail({ kind: "cannot", why: "the cancel was reached with no order named" })
        const called = await context.tools.call(TOOL.recordUpdate, CANCEL_OF(orderId))
        if (!called.ok && called.declined === true) return { orderId, orderNo: null, declined: true }
        const cancelled = updatedShape.safeParse(valueOrCannot(context, TOOL.recordUpdate, called))
        if (!cancelled.success)
            return context.fail({ kind: "cannot", why: `${TOOL.recordUpdate} answered no order number` })
        return { orderId, orderNo: cancelled.data.record.values.orderNo, declined: false }
    },
    examples: [
        {
            name: "the customer's order is cancelled by its id once the founder approved the call; its number goes on to the customer's line",
            params: {},
            input: { orderId: "o7", reason: "the customer no longer needs it" },
            tools: [
                {
                    id: TOOL.recordUpdate,
                    args: CANCEL_OF("o7"),
                    answer: answered({
                        record: {
                            id: "o7",
                            version: "2",
                            createdAt: "2026-11-11T08:00:00.000Z",
                            updatedAt: "2026-11-11T09:00:00.000Z",
                            values: { orderNo: "DH-7", status: "cancelled" },
                        },
                    }),
                },
            ],
            output: { orderId: "o7", orderNo: "DH-7", declined: false },
        },
        {
            name: "an order the record tool refuses stops the run with the refusal, nothing is said to the customer",
            params: {},
            input: { orderId: "o7", reason: "the customer no longer needs it" },
            tools: [{ id: TOOL.recordUpdate, args: CANCEL_OF("o7"), answer: refused("not_found") }],
            failure: { kind: "cannot", why: `${TOOL.recordUpdate} refused: not_found` },
        },
        {
            name: "the founder declines the cancel: the order stays, the node returns declined, nothing is said to the customer",
            params: {},
            input: { orderId: "o7", reason: "the customer no longer needs it" },
            tools: [{ id: TOOL.recordUpdate, args: CANCEL_OF("o7"), answer: refused("declined") }],
            output: { orderId: "o7", orderNo: null, declined: true },
        },
        {
            name: "reached with no order named (a wiring fault: a cancel turn names one): nothing is cancelled",
            params: {},
            input: { orderId: null, reason: null },
            tools: [],
            failure: { kind: "cannot", why: "the cancel was reached with no order named" },
        },
    ],
})
