import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The durable queue of the deferred vietcombank receipt consumer. */
export const VIETCOMBANK_DELIVERY_QUEUE = "vietcombank-delivery"
/** The receipt identity consumed by this queue. */
interface ReceiptReference {
    /** The committed provider delivery identity. */
    readonly deliveryId: string
}

/** Validates a committed receipt reference before the worker resolves its payload. */
export const isVietcombankDeliveryRecorded = (value: unknown): value is ReceiptReference =>
    typeof value === "object" &&
    value !== null &&
    "deliveryId" in value &&
    typeof value.deliveryId === "string" &&
    value.deliveryId.trim().length > 0

@Injectable()
/** Publishes a receipt reference using the transaction that records it. */
export class VietcombankDeliveryQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Uses the intake's dedupe identity so a duplicate cannot create another delivery job. */
    enqueueDeliveryRecorded(message: ReceiptReference, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, VIETCOMBANK_DELIVERY_QUEUE, message, {
            dedupeKey: `${VIETCOMBANK_DELIVERY_QUEUE}:${message.deliveryId}`,
        })
    }
}
