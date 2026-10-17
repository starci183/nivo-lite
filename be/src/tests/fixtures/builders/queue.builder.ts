import type { EntityManager } from "typeorm"
import { deliveryOf } from "@modules/platform/queue"
import type { QueueOutbox, QueueReadRow } from "@modules/platform/queue"
import { CONTENT_TICK_QUEUE } from "@modules/queues/content-tick"

/** Persists an outbox/message pair using the real producer in the caller's transaction. */
export const queueBuilder = (outbox: QueueOutbox, proofId: string) => ({
    delivery: (row: QueueReadRow, signal: AbortSignal) => deliveryOf(CONTENT_TICK_QUEUE, row, signal),
    build: (tx: EntityManager, dedupeKey?: string) => outbox.write(tx, CONTENT_TICK_QUEUE, { proofId }, { dedupeKey }),
})
