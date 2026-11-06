import { SdkError } from "../sdk-error"

/** The HTTP status the queue's failure classification reads as "the other side was away, deliver again" (it retries a 503 by itself). */
const UNAVAILABLE = 503

/**
 * Thrown by the run of a declared job to have the queue deliver it again with its backoff, and park it with one alert once the
 * attempts are spent: the channel behind a door call was away, or a record moved since the job read it. `at` names the job.
 */
export class JobRetry extends SdkError<"JOB_RETRY"> {
    /** What the queue's failure classification reads: a 503 is transient. */
    readonly status: number = UNAVAILABLE

    constructor(at: string) {
        super("JOB_RETRY", at)
    }
}

/** Has the queue deliver the job again: throws `JobRetry` for the job named. */
export const retryJob = (job: string): never => {
    throw new JobRetry(job)
}
