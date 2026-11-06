import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { canCancel } from "../../../rules/sales/order-status"
import { SALES_MANAGE } from "../constants"
import { salesOrders } from "../ports"
import { refusedWith, writeRefusal } from "../refusals"
import { orderRowOf } from "../sales-records"
import type { OrderIdInput } from "../sales.types"

const input: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().min(1).max(MAX_ID) })

/** The cancellation of a draft order, shared by the action and by the decision of the owner; an order that is no draft is refused as data. */
export const cancelOrderRun = async (orders: EntityApi, { id }: OrderIdInput): Promise<ActionResult> => {
    const record = await orders.get(id)
    const order = record === null ? null : orderRowOf(record)
    if (order === null) return refusedWith("missing")
    if (!canCancel(order.status)) return refusedWith("order_not_cancellable")
    const written = await orders.update(order.id, order.version, { status: "cancelled" })
    return written.ok ? { ok: true } : writeRefusal(written)
}

/** `sales.cancel-order`: cancels a draft order; an order that is no draft any more is refused as data. */
export const cancelOrderAction: ActionDefinition = defineAction({
    id: "sales.cancel-order",
    permission: SALES_MANAGE,
    label: { key: "action_cancel_order" },
    input,
    ports: { orders: salesOrders },
    transactional: true,
    run: ({ orders }, given) => cancelOrderRun(orders, given),
    refreshes: [
        "sales.orders",
        "sales.order-counts",
        "sales.order",
        "sales.orders-waiting",
        "sales.attention",
        "sales.decisions",
        "sales.figures",
    ],
})
