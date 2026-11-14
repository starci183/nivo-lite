import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { bilingualOf } from "../../../shared/messages/catalog"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused, valueOrCannot } from "../../../shared/nodes/tool-answers"
import { ORDER_AWAITING } from "./sales-order"
import { SALES_ORDER_ENTITY } from "../../../shared/entities/sales-entity-names"

/** One order that waits for its money, as the match compares it. */
export interface AwaitingOrder {
    /** The order. */
    readonly orderId: string
    /** Its code: the text a transfer content must contain. */
    readonly orderNo: string
    /** Its total, VND, or null when the record keeps none (then no amount equals it). */
    readonly amountVnd: number | null
    /** Its customer, or null. */
    readonly contactId: string | null
}

/** The orders that wait for their money. */
export interface AwaitingOrdersOutput {
    /** Newest first, at most one page. */
    readonly orders: ReadonlyArray<AwaitingOrder>
}

/** The most orders one match compares (the loop's own cap). */
const ORDERS_MAX = 50

const input: NodeSchema<Record<string, never>> = z.strictObject({})

const awaitingOrder: NodeSchema<AwaitingOrder> = z.object({
    orderId: z.string().min(1).max(MAX_ID),
    orderNo: z.string().min(1).max(MAX_ID),
    amountVnd: z.number().int().min(0).nullable(),
    contactId: z.string().min(1).max(MAX_ID).nullable(),
})

const output: NodeSchema<AwaitingOrdersOutput> = z.object({
    orders: z.array(awaitingOrder).max(ORDERS_MAX).describe("The orders that wait for their money, newest first."),
})

/** The record list of the orders that wait for their money, newest first (the type's `status_recent` index serves it). */
const LIST = {
    type: SALES_ORDER_ENTITY,
    where: { op: "eq", field: "status", value: ORDER_AWAITING },
    order: [["createdAt", "desc"]],
    limit: ORDERS_MAX,
    fields: ["orderNo", "amountVnd", "contactId"],
}

/**
 * The same list narrowed to orders whose person is still a live contact: the contact field compared with the page's people (`in`). The
 * engine reads a contact filter THROUGH its contacts (E-FIX6, DEF-6): an erased contact (or an id merged into an erased one) stands for no
 * id, so an order of an erased person is not found, while its record keeps the reference (`onContactDelete: "clear"`).
 */
const liveListOf = (contactIds: ReadonlyArray<string>) => ({
    type: SALES_ORDER_ENTITY,
    where: {
        op: "and",
        of: [
            { op: "eq", field: "status", value: ORDER_AWAITING },
            { op: "in", field: "contactId", values: [...contactIds] },
        ],
    },
    order: [["createdAt", "desc"]],
    limit: ORDERS_MAX,
    fields: ["orderNo"],
})

/** One page of the record list. */
const pageShape = z.object({
    records: z
        .array(
            z.object({
                id: z.string().min(1).max(MAX_ID),
                values: z.object({
                    orderNo: z.string().min(1).max(MAX_ID),
                    amountVnd: z.number().int().min(0).nullish(),
                    contactId: z.string().min(1).max(MAX_ID).nullish(),
                }),
            }),
        )
        .max(ORDERS_MAX),
})

/**
 * `sales.awaiting-orders` (Don cho tien): lists the `blocks-core.sales.order` records that wait for their money (`nivo.tool.record.list`, status
 * `confirmed`, newest first, one page) for the graph's match to compare a credit with, item by item, in its own expressions. An order whose
 * person was erased is left out (DEF-6, R41 Q11): a second read of the same page through the contact field, which the engine answers only
 * for live contacts; an order with no person stays. Plain logic: it decides nothing, it compares nothing.
 */
export const salesAwaitingOrdersNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.awaiting-orders",
    title: bilingualOf("nodeSalesAwaitingOrdersTitle"),
    description: { vi: "Li\u1ec7t k\u00ea c\u00e1c \u0111\u01a1n \u0111ang ch\u1edd kh\u00e1ch chuy\u1ec3n ti\u1ec1n \u0111\u1ec3 \u0111\u1ed1i chi\u1ebfu v\u1edbi kho\u1ea3n ti\u1ec1n v\u1eeba v\u1ec1.", en: "Lists the orders still waiting for their money so an incoming credit can be matched against them." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    run: async (_given, context) => {
        const page = pageShape.safeParse(
            valueOrCannot(context, TOOL.recordList, await context.tools.call(TOOL.recordList, LIST)),
        )
        if (!page.success) return context.fail({ kind: "cannot", why: `${TOOL.recordList} answered an unknown shape` })
        const orders = page.data.records.map((record) => ({
            orderId: record.id,
            orderNo: record.values.orderNo,
            amountVnd: record.values.amountVnd ?? null,
            contactId: record.values.contactId ?? null,
        }))
        // An order of an ERASED person is never offered (R41 Q11, DEF-6): a credit naming it is a stranger credit, the team is told and the
        // order is not paid. Which people are live is the engine's answer to a read through the contact field, never decided here.
        const people = [...new Set(orders.flatMap((order) => (order.contactId === null ? [] : [order.contactId])))]
        if (people.length === 0) return { orders }
        const live = pageShape.safeParse(
            valueOrCannot(context, TOOL.recordList, await context.tools.call(TOOL.recordList, liveListOf(people))),
        )
        if (!live.success) return context.fail({ kind: "cannot", why: `${TOOL.recordList} answered an unknown shape` })
        const kept = new Set(live.data.records.map((record) => record.id))
        return { orders: orders.filter((order) => order.contactId === null || kept.has(order.orderId)) }
    },
    examples: [
        {
            name: "the orders that wait for their money are listed newest first, with their codes and totals",
            params: {},
            input: {},
            tools: [
                {
                    id: TOOL.recordList,
                    args: LIST,
                    answer: answered({
                        records: [
                            { id: "o2", values: { orderNo: "DH-20261113-0002", amountVnd: 9000, contactId: "contact-2" } },
                            { id: "o1", values: { orderNo: "DH-20261113-0001", amountVnd: 4500, contactId: "contact-1" } },
                        ],
                        next: null,
                    }),
                },
                {
                    id: TOOL.recordList,
                    args: liveListOf(["contact-2", "contact-1"]),
                    answer: answered({
                        records: [
                            { id: "o2", values: { orderNo: "DH-20261113-0002" } },
                            { id: "o1", values: { orderNo: "DH-20261113-0001" } },
                        ],
                        next: null,
                    }),
                },
            ],
            output: {
                orders: [
                    { orderId: "o2", orderNo: "DH-20261113-0002", amountVnd: 9000, contactId: "contact-2" },
                    { orderId: "o1", orderNo: "DH-20261113-0001", amountVnd: 4500, contactId: "contact-1" },
                ],
            },
        },
        {
            name: "an order of an erased person is not offered (its credit is a stranger's); an order with no person stays",
            params: {},
            input: {},
            tools: [
                {
                    id: TOOL.recordList,
                    args: LIST,
                    answer: answered({
                        records: [
                            { id: "o3", values: { orderNo: "DH-20261113-0003", amountVnd: 7000, contactId: null } },
                            { id: "o2", values: { orderNo: "DH-20261113-0002", amountVnd: 9000, contactId: "contact-erased" } },
                            { id: "o1", values: { orderNo: "DH-20261113-0001", amountVnd: 4500, contactId: "contact-1" } },
                        ],
                        next: null,
                    }),
                },
                {
                    id: TOOL.recordList,
                    args: liveListOf(["contact-erased", "contact-1"]),
                    answer: answered({ records: [{ id: "o1", values: { orderNo: "DH-20261113-0001" } }], next: null }),
                },
            ],
            output: {
                orders: [
                    { orderId: "o3", orderNo: "DH-20261113-0003", amountVnd: 7000, contactId: null },
                    { orderId: "o1", orderNo: "DH-20261113-0001", amountVnd: 4500, contactId: "contact-1" },
                ],
            },
        },
        {
            name: "a list the record tool refuses stops the run with the refusal",
            params: {},
            input: {},
            tools: [{ id: TOOL.recordList, args: LIST, answer: refused("query_not_indexed") }],
            failure: { kind: "cannot", why: `${TOOL.recordList} refused: query_not_indexed` },
        },
    ],
})
