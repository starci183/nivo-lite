import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

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

@Injectable()
/** Publishes a receipt reference using the transaction that records it. */
export class SepayDeliveryQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Uses the intake's dedupe identity so a duplicate cannot create another delivery job. */
    enqueueDeliveryRecorded(message: SepayDeliveryRecorded, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, SEPAY_DELIVERY_QUEUE, message, {
            dedupeKey: `${SEPAY_DELIVERY_QUEUE}:${message.deliveryId}`,
        })
    }
}
