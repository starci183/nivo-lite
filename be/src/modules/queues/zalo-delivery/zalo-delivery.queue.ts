import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The durable queue of the deferred zalo receipt consumer. */
export const ZALO_DELIVERY_QUEUE = "zalo-delivery"
/** The durable receipt event consumed after the HTTP transaction commits. */
export interface ZaloDeliveryRecorded {
    /** The original provider delivery key. */
    readonly deliveryId: string
}

/** Validates a committed receipt reference before the worker resolves its payload. */
export const isZaloDeliveryRecorded = (value: unknown): value is ZaloDeliveryRecorded =>
    typeof value === "object" &&
    value !== null &&
    "deliveryId" in value &&
    typeof value.deliveryId === "string" &&
    value.deliveryId.trim().length > 0

@Injectable()
/** Publishes a receipt reference using the transaction that records it. */
export class ZaloDeliveryQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Uses the intake's dedupe identity so a duplicate cannot create another delivery job. */
    enqueueDeliveryRecorded(message: ZaloDeliveryRecorded, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, ZALO_DELIVERY_QUEUE, message, {
            dedupeKey: `${ZALO_DELIVERY_QUEUE}:${message.deliveryId}`,
        })
    }
}
