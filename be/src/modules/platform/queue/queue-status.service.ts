import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
import type { OptionalQueueJobStatus, QueueJobStatus } from "./queue.contracts"

@Injectable()
/** Reads authoritative queue state without granting access to the queue's internal tables. */
export class QueueStatusService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Reads one workspace's job by its stable dedupe key; retries remain queued until finally archived. */
    async status(workspaceId: string, queue: string, dedupeKey: string): Promise<OptionalQueueJobStatus> {
        const [row] = await callDbFunction<QueueJobStatus>(this.entityManager, "public.job_status", [
            workspaceId,
            queue,
            dedupeKey,
        ])
        return row ?? null
    }

    /**
     * True when a job of the queue and name already stands under the dedupe key, in any state (queued, running, done or failed), read in
     * the transaction `tx`: writing the same key again would be a no-op (`job_enqueue` keeps the first row), so a producer that re-arms
     * on a timer can tell a new job from one that already stood.
     */
    async stands(tx: EntityManager, workspaceId: string, queue: string, job: string, dedupeKey: string): Promise<boolean> {
        const [row] = await callDbFunction<{ id: string }>(tx, "public.job_status", [workspaceId, queue, job, dedupeKey])
        return row !== undefined
    }
}
