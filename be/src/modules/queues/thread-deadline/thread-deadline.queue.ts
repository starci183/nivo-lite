import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { THREAD_DEADLINE_QUEUE, ThreadDeadlineJob, threadDeadlineKey } from "./thread-deadline.contracts"
import type { ThreadDeadlinePayload } from "./thread-deadline.contracts"

@Injectable()
/**
 * The typed producer of the thread-deadline queue: the one way a deadline job starts. The job waits in the outbox until it is due (a
 * delayed row, durable across restarts); its key is the stop as it stood, so arming the same deadline twice is one job. An app with no
 * queue outbox (a test world) arms nothing and answers false: the minute sweep of the threads fires a deadline that came anyway.
 */
export class ThreadDeadlineQueue {
    constructor(@Optional() @InjectQueueOutbox() private readonly outbox?: QueueOutbox) {}

    /** Writes the deadline job in the caller's transaction, due in `delayMs` (now when not positive). False when this app has no outbox. */
    async arm(payload: ThreadDeadlinePayload, delayMs: number, tx: EntityManager): Promise<boolean> {
        if (this.outbox === undefined) return false
        await this.outbox.write(tx, THREAD_DEADLINE_QUEUE, payload, {
            job: ThreadDeadlineJob.Fire,
            dedupeKey: threadDeadlineKey(payload),
            ...(delayMs > 0 ? { delayMs: Math.ceil(delayMs) } : {}),
        })
        return true
    }
}
