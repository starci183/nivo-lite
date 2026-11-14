
/** The durable queue of the deferred sepay receipt consumer. */
export const SEPAY_DELIVERY_QUEUE = "sepay-delivery"
/** The durable receipt event consumed after the HTTP transaction commits. */
export interface SepayDeliveryRecorded {
    /** The original provider delivery key. */
    readonly deliveryId: string
}

/** Validates a committed receipt reference before the worker resolves its payload. */
export const isSepayDeliveryRecorded = (value: unknown): value is SepayDeliveryRecorded =>
    typeof value === "object" &&
    value !== null &&
    "deliveryId" in value &&
    typeof value.deliveryId === "string" &&
    value.deliveryId.trim().length > 0
