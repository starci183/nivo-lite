import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox, InjectQueueStatusService, type QueueOutbox, type QueueStatusService } from "@modules/platform/queue"
import {
    THREAD_DEADLINE_QUEUE,
    ThreadDeadlineJob,
    threadDeadlineKey,
    type ThreadDeadlinePayload,
} from "./thread-deadline.contracts"

/**
 * What arming did: a new job was `written`, the same job (the stop or park as it stood) was already `standing` and nothing was written,
 * or the app has no outbox (`unqueued`).
 */
export type DeadlineJobArming = "written" | "standing" | "unqueued"

@Injectable()
/**
 * The typed producer of the thread-deadline queue: the one way a deadline job starts. The job waits in the outbox until it is due (a
 * delayed row, durable across restarts); its key is the stop as it stood, so arming the same deadline twice is one job. An app with no
 * queue outbox (a test world) arms nothing and answers false: the minute sweep of the threads fires a deadline that came anyway.
 */
export class ThreadDeadlineQueue {
    constructor(
        @Optional() @InjectQueueOutbox() private readonly outbox?: QueueOutbox,
        @Optional() @InjectQueueStatusService() private readonly status?: QueueStatusService,
    ) {}

    /**
     * Writes the deadline job in the caller's transaction, due in `delayMs` (now when not positive), unless the job of that key already
     * stands (`standing`: the minute sweep re-arms every open stop, and only a missed one must be written). `unqueued` when this app has
     * no outbox. Without the status reader the write is made (the key still keeps it one job) and answered `written`.
     */
    async arm(payload: ThreadDeadlinePayload, delayMs: number, tx: EntityManager): Promise<DeadlineJobArming> {
        if (this.outbox === undefined) return "unqueued"
        const dedupeKey = threadDeadlineKey(payload)
        if (await this.status?.stands(tx, payload.workspaceId, THREAD_DEADLINE_QUEUE, ThreadDeadlineJob.Fire, dedupeKey))
            return "standing"
        await this.outbox.write(tx, THREAD_DEADLINE_QUEUE, payload, {
            job: ThreadDeadlineJob.Fire,
            dedupeKey,
            ...(delayMs > 0 ? { delayMs: Math.ceil(delayMs) } : {}),
        })
        return "written"
    }
}
