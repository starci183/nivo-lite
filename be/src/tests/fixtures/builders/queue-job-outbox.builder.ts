import { recordingQueueOutbox } from "@starci/jest-preset"
import type { QueueWriteOptions } from "@modules/platform/queue"

/** One job a producer wrote: the queue and payload the recording outbox keeps, and the job name, dedupe key and delay it names. */
export interface WrittenJob {
    readonly queue: string
    readonly payload: object
    readonly job: string | undefined
    readonly dedupeKey: string | undefined
    readonly delayMs: number | undefined
}

/**
 * The queue outbox double that also keeps what a producer names for a job (its job, dedupe key and delay), which the plain
 * `recordingQueueOutbox` drops. `written` is every job in order; `inTransaction` says every write went through a transaction manager.
 */
export const jobRecordingOutbox = () => {
    const recorder = recordingQueueOutbox()
    const options: Array<QueueWriteOptions | undefined> = []
    return {
        async write(tx: unknown, queue: string, payload: object, named?: QueueWriteOptions): Promise<void> {
            await recorder.write(tx, queue, payload)
            options.push(named)
        },
        get written(): ReadonlyArray<WrittenJob> {
            return recorder.jobs.map(({ queue, payload }, index) => ({
                queue,
                payload,
                job: options[index]?.job,
                dedupeKey: options[index]?.dedupeKey,
                delayMs: options[index]?.delayMs,
            }))
        },
        get inTransaction(): boolean {
            return recorder.allInTransaction
        },
    }
}
