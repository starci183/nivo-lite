import type { QueueDelivery } from "@modules/platform/queue"
import type { ClaimedJob } from "./jobs.contracts"

/**
 * The base of every job processor. The runner claims the delivery with a bumped fencing token, calls `process`, and settles the job
 * through the guarded writes, so a processor holds only what its job does and never touches the job row.
 */
export abstract class FencedProcessor {
    /** The queue this processor consumes: the `<QUEUE>_QUEUE` constant of its `modules/queues/<queue>`. */
    abstract readonly queue: string

    /** The only job of the queue this processor runs (its `<JOB>` constant); every job of the queue when absent. It is the kind of the job row when set. */
    readonly job?: string

    /** The most deliveries of this processor's queue that run at once; the app default when absent. */
    readonly concurrency?: number

    /** Runs the job; a throw fails this delivery and the queue retries it, unless it is a `QueueError` that ends or delays the job. */
    abstract process(job: ClaimedJob): Promise<void>

    /** Runs once when the job ends as failed (attempts used up or an unrecoverable error); write the failure the owner sees. The default does nothing. */
    onFailed(_delivery: QueueDelivery, _cause: unknown): Promise<void> {
        return Promise.resolve()
    }
}
