import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { BankFeedDeliveryRecorded } from "./bank-feed-delivery.contracts"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

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

@Injectable()
/** Publishes a receipt reference using the transaction that records it. */
export class BankFeedDeliveryQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Uses the intake's dedupe identity so a duplicate cannot create another delivery job. */
    enqueueDeliveryRecorded(message: BankFeedDeliveryRecorded, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, BANK_FEED_DELIVERY_QUEUE, message, {
            dedupeKey: `${BANK_FEED_DELIVERY_QUEUE}:${message.provider}:${message.deliveryId}`,
        })
    }
}
