import { type QueueOutbox, type QueueDelivery, deliveryOf } from "@modules/platform/queue"
import type { EntityManager } from "typeorm"
import { CONTENT_TICK_QUEUE } from "@modules/queues/content-tick"

/** The broker-bound envelope fields a delivery is observed from. */
export interface DeliveredJobMessage {
    /** The job name inside the queue. */
    readonly name?: string
    /** The payload the producer wrote. */
    readonly payload?: object
}

/** The outbox row and envelope fields a proof delivery needs. */
export interface DeliveredJobRow {
    /** The outbox row id. */
    readonly id: string
    /** The durable attempt the row is observed at. */
    readonly attempt: number
    /** The reconstructed broker envelope. */
    readonly message: DeliveredJobMessage
}

/** Persists the durable outbox row using the real producer in the caller's transaction. */
export const queueBuilder = (outbox: QueueOutbox, proofId: string) => ({
    delivery: (row: DeliveredJobRow, signal: AbortSignal): QueueDelivery =>
        deliveryOf(
            CONTENT_TICK_QUEUE,
            { id: row.id, name: CONTENT_TICK_QUEUE, data: row.message.payload ?? {} },
            row.attempt,
            signal,
        ),
    build: (tx: EntityManager, dedupeKey?: string): Promise<void> =>
        outbox.write(tx, CONTENT_TICK_QUEUE, { proofId }, { dedupeKey }),
})
