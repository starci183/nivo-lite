import type { BankFeedDeliveryRecorded } from "./bank-feed-delivery.contracts"

/** The durable queue of the deferred bank-feed receipt consumer. */
export const BANK_FEED_DELIVERY_QUEUE = "bank-feed-delivery"

/** Validates a committed receipt reference before the worker resolves its payload. */
export const isBankFeedDeliveryRecorded = (value: unknown): value is BankFeedDeliveryRecorded =>
    typeof value === "object" &&
    value !== null &&
    "deliveryId" in value &&
    typeof value.deliveryId === "string" &&
    value.deliveryId.trim().length > 0 &&
    "provider" in value &&
    (value.provider === "casso" || value.provider === "payos" || value.provider === "sepay-feed")
