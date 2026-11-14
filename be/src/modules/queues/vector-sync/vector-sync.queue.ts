import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox, type QueueOutbox } from "@modules/platform/queue"
import {
    VECTOR_SYNC_QUEUE,
    VectorSyncJob,
    vectorReconcileDedupeKey,
    vectorSyncDedupeKey,
    vectorSyncDelayOf,
    type VectorSyncPayload,
} from "./vector-sync.contracts"

/** The payload of the reconcile follow-up job: when the run that used its whole budget ended, epoch milliseconds. */
export interface VectorReconcileFollowUp {
    /** When the run ended, epoch milliseconds. */
    readonly resumedAt: number
}

@Injectable()
/**
 * The typed producer of the vector-sync queue: the one way a change of Postgres rows reaches the vector index. Postgres first: the
 * job is written in the transaction that changes the rows, so it exists exactly when the change does, and the index follows after
 * the commit. Nothing writes to the index inside a request.
 */
export class VectorSyncQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /**
     * Enqueues the sync of the rows a change touched, in the caller's transaction. The changes of one document inside one window
     * (`SOURCE_SYNC_WINDOW_MS`) are one job, run when the window closes.
     */
    enqueueSync(payload: VectorSyncPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, VECTOR_SYNC_QUEUE, payload, {
            job: VectorSyncJob.Sync,
            dedupeKey: vectorSyncDedupeKey(payload),
            delayMs: vectorSyncDelayOf(payload),
        })
    }

    /** Enqueues the follow-up of a reconcile run that used its whole budget, in the caller's transaction. */
    enqueueReconcile(payload: VectorReconcileFollowUp, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, VECTOR_SYNC_QUEUE, payload, {
            job: VectorSyncJob.Reconcile,
            dedupeKey: vectorReconcileDedupeKey(payload.resumedAt),
        })
    }
}
