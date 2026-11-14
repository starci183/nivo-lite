import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import type { NodeContext } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../shared/bounds"
import type { OrderItemLine } from "../entities/order.entity"
import { valueOrCannot } from "../../../shared/nodes/tool-answers"
import type { DraftLine } from "./consult.draft"
import { SALES_ORDER_ENTITY } from "../../../shared/entities/sales-entity-names"

/** The status an order is created in: the customer agreed to the summary, the order waits for its money. */
export const ORDER_AWAITING = "confirmed"

/** The order line a record keeps for one line of the draft: the price of one as the customer was told, and what the line comes to. */
export const orderLineOf = (line: DraftLine): OrderItemLine => ({
    name: line.name,
    qty: line.quantity,
    unitVnd: line.unitVnd,
    amountVnd: line.quantity * line.unitVnd,
    ...(line.priceSource === undefined || line.priceSource === null ? {} : { priceSource: line.priceSource }),
})

/** An order line as JSON (a record value): the price source only when the line has one. */
export const orderLineJsonOf = (line: OrderItemLine): JsonObject => ({
    name: line.name,
    qty: line.qty,
    unitVnd: line.unitVnd,
    amountVnd: line.amountVnd,
    ...(line.priceSource === undefined ? {} : { priceSource: { kind: line.priceSource.kind, id: line.priceSource.id } }),
})

/** A draft line as JSON (an agent's input): the price source only when the line has one. */
export const draftLineJsonOf = (line: DraftLine): JsonObject => ({
    name: line.name,
    quantity: line.quantity,
    unitVnd: line.unitVnd,
    ...(line.priceSource === undefined || line.priceSource === null
        ? {}
        : { priceSource: { kind: line.priceSource.kind, id: line.priceSource.id } }),
})

/** The exact total of an order's lines, VND. */
export const orderTotalOf = (lines: ReadonlyArray<OrderItemLine>): number =>
    lines.reduce((sum, line) => sum + line.amountVnd, 0)

/** The text the order lists show of its lines (`itemsText`): `2 x name`, joined. A format, not a meaning. */
export const itemsTextOf = (lines: ReadonlyArray<OrderItemLine>): string =>
    lines.map((line) => `${String(line.qty)} x ${line.name}`).join(", ")

/** The values of an order the sales nodes read back from a record tool's answer. */
export interface OrderValues {
    /** The order's code, as the customer and the team see it (the type's sequence). */
    readonly orderNo: string
    /** Where the order stands. */
    readonly status: string
    /** Its total, VND, or null when the record keeps none. */
    readonly amountVnd: number | null
    /** The customer, or null when the order has none. */
    readonly contactId: string | null
}

/** The record a record tool answers, with the order values the sales nodes read. */
const orderRecordShape = z.object({
    record: z.object({
        id: z.string().min(1).max(MAX_ID),
        values: z.object({
            orderNo: z.string().min(1).max(MAX_ID),
            status: z.string().min(1).max(MAX_LINE),
            amountVnd: z.number().int().min(0).nullish(),
            contactId: z.string().min(1).max(MAX_ID).nullish(),
        }),
    }),
})

/** One order as the sales nodes read it: its id and the values above. */
export interface ReadOrder extends OrderValues {
    /** The record's id. */
    readonly id: string
}

/** The order of a record tool's answer (`record.get`, `record.create`, `record.update`), or the node stops: an answer it cannot read. */
export const orderOfAnswer = (context: Pick<NodeContext, "fail">, tool: string, value: unknown): ReadOrder => {
    const parsed = orderRecordShape.safeParse(value)
    if (!parsed.success) return context.fail({ kind: "cannot", why: `${tool} answered an order of an unknown shape` })
    const { id, values } = parsed.data.record
    return {
        id,
        orderNo: values.orderNo,
        status: values.status,
        amountVnd: values.amountVnd ?? null,
        contactId: values.contactId ?? null,
    }
}

/** Reads one order by id (`nivo.tool.record.get` on `blocks-core.sales.order`); a refusal stops the node with it. */
export const readOrder = async (context: Pick<NodeContext, "fail" | "tools">, orderId: string): Promise<ReadOrder> =>
    orderOfAnswer(
        context,
        TOOL.recordGet,
        valueOrCannot(context, TOOL.recordGet, await context.tools.call(TOOL.recordGet, { type: SALES_ORDER_ENTITY, id: orderId })),
    )

/** An order record as an example's record tool answers it. */
export const orderRecordAnswerOf = (id: string, values: JsonObject): JsonObject => ({
    record: {
        id,
        version: "1",
        createdAt: "2026-11-13T08:00:00.000Z",
        updatedAt: "2026-11-13T08:00:00.000Z",
        values: { ...values },
    },
})
