import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { canCancel } from "../../../rules/sales/order-status"
import { SALES_MANAGE } from "../constants"
import { salesOrders } from "../ports"
import { refusedWith, writeRefusal } from "../refusals"
import { orderRowOf } from "../sales-records"

const input: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().min(1).max(MAX_ID) })

/** `sales.cancel-order`: cancels a draft order; an order that is no draft any more is refused as data. */
export const cancelOrderAction: ActionDefinition = defineAction({
    id: "sales.cancel-order",
    permission: SALES_MANAGE,
    label: { key: "action_cancel_order" },
    input,
    ports: { orders: salesOrders },
    transactional: true,
    run: async ({ orders }, { id }) => {
        const record = await orders.get(id)
        const order = record === null ? null : orderRowOf(record)
        if (order === null) return refusedWith("missing")
        if (!canCancel(order.status)) return refusedWith("order_not_cancellable")
        const written = await orders.update(order.id, order.version, { status: "cancelled" })
        return written.ok ? { ok: true } : writeRefusal(written)
    },
    refreshes: ["sales.orders", "sales.order-counts", "sales.order", "sales.orders-waiting"],
})
