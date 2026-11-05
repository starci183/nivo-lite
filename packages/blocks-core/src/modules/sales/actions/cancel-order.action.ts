import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { canCancel } from "../../../rules/sales/order-status"
import { SALES_MANAGE } from "../constants"
import { salesOrderStore } from "../ports"
import type { OrderStore } from "../ports"
import type { OrderIdInput } from "../sales.types"
import { CONFLICT, refusedWith } from "../refusals"

const input: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().min(1).max(MAX_ID) })

/** The stores a cancellation reads and writes. */
export interface CancelStores {
    /** The orders. */
    readonly orders: OrderStore
}

/** Cancels a draft order; shared by the action and by the owner's decision. */
export const cancelOrderRun = async ({ orders }: CancelStores, { id }: OrderIdInput): Promise<ActionResult> => {
    const order = await orders.get(id)
    if (order === null) return refusedWith("missing")
    if (!canCancel(order.status)) return refusedWith("order_not_cancellable")
    const written = await orders.update(order.id, order.version, { status: "cancelled" })
    if (written.ok) return { ok: true }
    return written.reason === "missing" ? refusedWith("missing") : CONFLICT
}

/** `sales.cancel-order`: cancels a draft order; an order that is no draft any more is refused as data. */
export const cancelOrderAction: ActionDefinition = defineAction({
    id: "sales.cancel-order",
    permission: SALES_MANAGE,
    label: { key: "action_cancel_order" },
    input,
    ports: { orders: salesOrderStore },
    transactional: true,
    run: cancelOrderRun,
    refreshes: ["sales.orders", "sales.order-counts", "sales.order", "sales.orders-waiting"],
})
