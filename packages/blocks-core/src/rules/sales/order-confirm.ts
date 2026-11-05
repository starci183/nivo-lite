import { needsOwner } from "../../nodes/order/order.policy"
import type { OrderStatus } from "./order-status"

/** What deciding to confirm an order looks at. */
export interface ConfirmInput {
    /** Where the order stands. */
    readonly status: OrderStatus
    /** The amount of the order, VND, or null while a line has no price. */
    readonly amountVnd: number | null
    /** From which amount the owner decides. */
    readonly thresholdVnd: number
    /** Whether the one confirming holds the owner's right. */
    readonly byOwner: boolean
}

/** What happens when confirming is asked. */
export type ConfirmDecision =
    | { readonly kind: "confirm" }
    | { readonly kind: "already" }
    | { readonly kind: "wait_owner" }
    | { readonly kind: "refused"; readonly reason: "not_confirmable" }

/** The part of an order that decides whether it waits for the owner. */
export interface WaitingCandidate {
    /** Where the order stands. */
    readonly status: OrderStatus
    /** The amount, VND, or null while unknown. */
    readonly amountVnd: number | null
}

/** Whether a draft order waits for the owner: its total is at the threshold or above, or still unknown. */
export const waitsForOwner = (order: WaitingCandidate, thresholdVnd: number): boolean =>
    order.status === "draft" && (order.amountVnd === null || needsOwner(order.amountVnd, thresholdVnd))

/**
 * Decides what confirming an order does. Only a draft is confirmed, once (an order already confirmed changes nothing, a cancelled or
 * failed one cannot be). A draft that waits for the owner is confirmed only by someone who holds the owner's right.
 */
export const confirmDecision = (input: ConfirmInput): ConfirmDecision => {
    if (input.status === "cancelled" || input.status === "failed_system")
        return { kind: "refused", reason: "not_confirmable" }
    if (input.status !== "draft") return { kind: "already" }
    const waits = waitsForOwner({ status: input.status, amountVnd: input.amountVnd }, input.thresholdVnd)
    return waits && !input.byOwner ? { kind: "wait_owner" } : { kind: "confirm" }
}
