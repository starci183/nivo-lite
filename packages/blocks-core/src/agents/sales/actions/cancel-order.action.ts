import { defineAction, type ActionDefinition, type ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { cancelVerdictOf } from "../rules/order-status"
import { SALES_MANAGE } from "../constants"
import { cancelFactsOf, openClaimsOf } from "../order-links"
import { salesClaims, salesInvoices, salesOrders, salesTransactions } from "../ports"
import { refusedWith, writeRefusal } from "../refusals"
import { orderRowOf } from "../sales-records"
import type { OrderIdInput } from "../sales.types"

const input: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().min(1).max(MAX_ID) })

/** The stores a cancellation reads and writes: the orders, and the payments, invoices and claims that hang on an order. */
export interface CancelStores {
    /** The orders. */
    readonly orders: EntityApi
    /** The payments, counted for the ones allocated to the order. */
    readonly transactions: EntityApi
    /** The invoices, counted for the ones issued for the order. */
    readonly invoices: EntityApi
    /** The customers' payment claims, withdrawn with their order. */
    readonly claims: EntityApi
}

/**
 * The cancellation of an order, shared by the action and by the decision of the owner. A draft may be cancelled, and a confirmed order may
 * while no payment is allocated to it and no invoice was issued for it; anything else is refused as data with its reason. A cancelled order
 * takes down what still waits on it: its open and escalated payment claims are withdrawn (a payment that arrives later finds an order
 * that no longer waits for money, and is left to the owner). The order and its claims change in the one transaction of the action.
 */
export const cancelOrderRun = async (stores: CancelStores, { id }: OrderIdInput): Promise<ActionResult> => {
    const record = await stores.orders.get(id)
    const order = record === null ? null : orderRowOf(record)
    if (order === null) return refusedWith("missing")
    const verdict = cancelVerdictOf(await cancelFactsOf(stores, order))
    if (!verdict.ok) return refusedWith(verdict.reason)
    const written = await stores.orders.update(order.id, order.version, { status: "cancelled" })
    if (!written.ok) return writeRefusal(written)
    const waiting = await openClaimsOf(stores.claims, order.id)
    const withdrawn = await Promise.all(
        waiting.map((claim) => stores.claims.update(claim.id, claim.version, { status: "withdrawn" })),
    )
    const failed = withdrawn.find((result) => !result.ok)
    return failed === undefined || failed.ok ? { ok: true } : writeRefusal(failed)
}

/** `sales.cancel-order`: cancels a draft order, or a confirmed one with no payment allocated and no invoice; any other is refused as data with its reason. */
export const cancelOrderAction: ActionDefinition = defineAction({
    id: "sales.cancel-order",
    permission: SALES_MANAGE,
    label: { key: "action_cancel_order" },
    input,
    ports: { orders: salesOrders, transactions: salesTransactions, invoices: salesInvoices, claims: salesClaims },
    transactional: true,
    run: (stores, given) => cancelOrderRun(stores, given),
    refreshes: [
        "blocks-core.sales.api.order.list",
        "blocks-core.sales.api.order.counts",
        "blocks-core.sales.api.order.get",
        "blocks-core.sales.api.order.waiting",
        "blocks-core.sales.api.lead.attention",
        "blocks-core.sales.api.order.decisions",
        "blocks-core.sales.api.order.figures",
    ],
})
