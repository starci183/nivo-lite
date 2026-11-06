import type { ChatDeliveryClaim } from "./chat-records.contracts"

/** A send started without a durable acknowledgement; receipt reconciliation is required before another send. */
export const CHAT_DELIVERY_UNKNOWN = "delivery_outcome_unknown"

/** The stored delivery errors that leave a send uncertain: another attempt waits for a receipt. */
const UNCERTAIN: ReadonlySet<string> = new Set([CHAT_DELIVERY_UNKNOWN, "delivery_failed", "zalo_error"])

/** What a stored message holds of its delivery. */
export interface DeliveryFacts {
    /** `sent` or `failed` once a delivery was tried, null before. */
    readonly deliveryStatus: string | null
    /** Why the last attempt failed, or null. */
    readonly deliveryError: string | null
}

/** True when a new send may start: the message was not delivered and no earlier attempt is uncertain. */
export const mayClaim = (facts: DeliveryFacts): boolean =>
    facts.deliveryStatus !== "sent" && (facts.deliveryError === null || !UNCERTAIN.has(facts.deliveryError))

/** The claim a message that could not be claimed stands at: already delivered, or an attempt of unknown outcome. */
export const heldClaimOf = (facts: DeliveryFacts): ChatDeliveryClaim =>
    facts.deliveryStatus === "sent" ? "acknowledged" : "ambiguous"
