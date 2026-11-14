import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { bilingualOf } from "../../../shared/messages/catalog"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused, valueOrCannot } from "../../../shared/nodes/tool-answers"
import { DRAFT_LINES_MAX, draftLineSchema, type DraftLine } from "./consult.draft"
import { ORDER_AWAITING, itemsTextOf, orderLineJsonOf, orderLineOf, orderOfAnswer, orderRecordAnswerOf, orderTotalOf } from "./sales-order"
import { SALES_ORDER_ENTITY } from "../../../shared/entities/sales-entity-names"


/** What the consult settled and the customer agreed to: the lines, the delivery and the customer. */
export interface OrderCreateInput {
    /** The customer, or null while the conversation has none. */
    readonly contactId: string | null
    /** The lines: what, how many, the price of one as the customer was told; null only when the graph is wired wrongly. */
    readonly items: ReadonlyArray<DraftLine> | null
    /** Where to deliver. */
    readonly address: string | null
    /** Who receives it when the customer named someone else, else null. */
    readonly recipientName: string | null
    /** The phone of the person who receives it. */
    readonly recipientPhone: string | null
    /** The day and time window, in the customer's words. */
    readonly deliveryAt: string | null
}

/** The order the step recorded. */
export interface OrderCreated {
    /** False: the order was written. */
    readonly declined: false
    /** The order's record id. */
    readonly orderId: string
    /** Its code (the type's sequence): what the customer writes as the transfer content. */
    readonly orderNo: string
    /** Its exact total, VND: the sum of the lines. */
    readonly amountVnd: number
    /** The lines as the order keeps them, for the message that tells the customer. */
    readonly lines: ReadonlyArray<DraftLine>
}

/** What a person's decline of the create leaves: no order, every member empty. */
export interface OrderCreateDeclined {
    /** True when a person declined recording the order on its card: no order was written; the graph tells the team and ends `declined`. */
    readonly declined: true
    /** Always null: no order was created. */
    readonly orderId: null
    /** Always null: no order was created. */
    readonly orderNo: null
    /** Always null: no order was created. */
    readonly amountVnd: null
    /** Always empty: no order was created. */
    readonly lines: readonly []
}

/** The order the step recorded, or the declined form: a union on `declined`, so a graph that routes the decline away reads the order's members as present. */
export type OrderCreateOutput = OrderCreated | OrderCreateDeclined

const nullableLine = z.string().min(1).max(MAX_LINE).nullable()

const input: NodeSchema<OrderCreateInput> = z.object({
    contactId: z.string().min(1).max(MAX_ID).nullable(),
    items: z.array(draftLineSchema).min(1).max(DRAFT_LINES_MAX).nullable(),
    address: nullableLine,
    recipientName: nullableLine,
    recipientPhone: nullableLine,
    deliveryAt: nullableLine,
})

const output: NodeSchema<OrderCreateOutput> = z.discriminatedUnion("declined", [
    z.object({
        declined: z.literal(false).describe("False: the order was written."),
        orderId: z.string().min(1).max(MAX_ID).describe("The order's record id."),
        orderNo: z.string().min(1).max(MAX_ID).describe("The order's code: what the customer writes as the transfer content."),
        amountVnd: z.number().int().min(0).describe("The order's exact total in VND: the sum of its lines."),
        lines: z.array(draftLineSchema).min(1).max(DRAFT_LINES_MAX).describe("The order's lines as it keeps them."),
    }),
    z.object({
        declined: z.literal(true).describe("True when a person declined recording the order on its card: no order was written."),
        orderId: z.null(),
        orderNo: z.null(),
        amountVnd: z.null(),
        lines: z.tuple([]),
    }),
])

/** The record create of an order: the lines priced as the customer was told, the exact total, the delivery, waiting for its money. */
const createOf = (given: OrderCreateInput, items: ReadonlyArray<DraftLine>) => {
    const lines = items.map((line) => orderLineOf(line))
    return {
        type: SALES_ORDER_ENTITY,
        values: {
            contactId: given.contactId,
            items: { lines: lines.map((line) => orderLineJsonOf(line)) },
            itemsText: itemsTextOf(lines),
            recipientName: given.recipientName,
            recipientPhone: given.recipientPhone,
            deliveryAddress: given.address,
            deliveryAt: given.deliveryAt,
            amountVnd: orderTotalOf(lines),
            status: ORDER_AWAITING,
        },
    }
}

/** The ready draft of the examples: two small baskets at 2000 and one card at 500, for Lan. */
const READY: OrderCreateInput = {
    contactId: "contact-1",
    items: [
        { name: "small basket", quantity: 2, unitVnd: 2000 },
        { name: "card", quantity: 1, unitVnd: 500 },
    ],
    address: "25 Nguyen Hue",
    recipientName: "Lan",
    recipientPhone: "0901 234 567",
    deliveryAt: "Saturday 9-11",
}

/** The create call of the examples' ready draft. */
const CREATE = createOf(READY, READY.items ?? [])

/**
 * `sales.order-create` (Ghi don hang): records the order the customer agreed to as a `blocks-core.sales.order` record (`nivo.tool.record.create`, the
 * core's generic store: what the flow CREATES lives in records). The lines keep what the customer was told (name, quantity, the price of
 * one the truth stated); the total is their exact sum, computed here (arithmetic, not meaning); the status is `confirmed`, the order
 * waits for its money. The record type's sequence gives the order its code, the transfer content the payment graph compares. A plain
 * tool call: nothing is decided. A person declining the create on its card (mode `ask`) is a business outcome: `declined: true`, no order,
 * the graph tells the team. Any other refusal of the record tool stops the run with it.
 */
export const salesOrderCreateNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.order-create",
    title: bilingualOf("nodeSalesOrderCreateTitle"),
    description: { vi: "Ghi l\u1ea1i \u0111\u01a1n h\u00e0ng kh\u00e1ch \u0111\u00e3 \u0111\u1ed3ng \u00fd: c\u00e1c d\u00f2ng h\u00e0ng, t\u1ed5ng ti\u1ec1n v\u00e0 m\u00e3 \u0111\u01a1n, \u0111\u01a1n ch\u1edd kh\u00e1ch chuy\u1ec3n ti\u1ec1n.", en: "Records the order the customer agreed to: its lines, total and code. The order then waits for the customer's payment." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    run: async (given, context) => {
        const items = given.items
        if (items === null || given.address === null || given.recipientPhone === null || given.deliveryAt === null)
            return context.fail({ kind: "cannot", why: "the order step was reached without a complete draft" })
        const create = createOf(given, items)
        const createdCall = await context.tools.call(TOOL.recordCreate, create)
        if (!createdCall.ok && createdCall.declined === true)
            return { orderId: null, orderNo: null, amountVnd: null, lines: [], declined: true as const }
        const created = orderOfAnswer(
            context,
            TOOL.recordCreate,
            valueOrCannot(context, TOOL.recordCreate, createdCall),
        )
        return { orderId: created.id, orderNo: created.orderNo, amountVnd: create.values.amountVnd, lines: [...items], declined: false as const }
    },
    examples: [
        {
            name: "the agreed draft becomes one confirmed order: the lines as the customer was told, the exact total, the delivery",
            params: {},
            input: READY,
            tools: [
                {
                    id: TOOL.recordCreate,
                    args: CREATE,
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
            output: { orderId: "o1", orderNo: "DH-20261113-0001", amountVnd: 4500, lines: READY.items ?? [], declined: false },
        },
        {
            name: "a person declines recording the order: no order exists and the node says declined",
            params: {},
            input: READY,
            tools: [{ id: TOOL.recordCreate, args: CREATE, answer: refused("declined") }],
            output: { orderId: null, orderNo: null, amountVnd: null, lines: [], declined: true },
        },
        {
            name: "a value the order type refuses stops the run with the refusal; no order is told",
            params: {},
            input: READY,
            tools: [{ id: TOOL.recordCreate, args: CREATE, answer: refused("invalid_value") }],
            failure: { kind: "cannot", why: `${TOOL.recordCreate} refused: invalid_value` },
        },
        {
            name: "reached without a complete draft (a wiring fault: only a ready turn routes here): nothing is recorded",
            params: {},
            input: { ...READY, items: null },
            failure: { kind: "cannot", why: "the order step was reached without a complete draft" },
        },
    ],
})
