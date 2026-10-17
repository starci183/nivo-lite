import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The durable queue of the deferred meta receipt consumer. */
export const META_DELIVERY_QUEUE = "meta-delivery"
/** The durable receipt reference consumed after intake commits. */
export interface MetaDeliveryRecorded {
    /** The original provider delivery key. */
    readonly deliveryId: string
}

/** Validates a committed receipt reference before the worker resolves its payload. */
export const isMetaDeliveryRecorded = (value: unknown): value is MetaDeliveryRecorded =>
    typeof value === "object" &&
    value !== null &&
    "deliveryId" in value &&
    typeof value.deliveryId === "string" &&
    value.deliveryId.trim().length > 0

@Injectable()
/** Publishes a receipt reference using the transaction that records it. */
export class MetaDeliveryQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Uses the intake's dedupe identity so a duplicate cannot create another delivery job. */
    enqueueDeliveryRecorded(message: MetaDeliveryRecorded, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, META_DELIVERY_QUEUE, message, {
            dedupeKey: `${META_DELIVERY_QUEUE}:${message.deliveryId}`,
        })
    }
}
