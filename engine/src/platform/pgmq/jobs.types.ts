import { BLOCKED_CREDITS, type JobName, type JobPayloads } from "./contracts"

/** How many starts a job gets before it is archived as failed. */
export const ATTEMPTS = 4

/** The pause after the first failed start; doubled with every further failure (5 s, 10 s, 20 s). */
export const BACKOFF_MS = 5_000

/** One delivery of a job as a handler receives it. */
export type JobContext<N extends JobName = JobName> = {
    /** The job's dedupe key (job_outbox.dedupe_key): stable across retries of the same job. */
    readonly id: string
    readonly name: N
    readonly payload: JobPayloads[N]
    /** The workspace the job belongs to (payload.workspaceId); the per-workspace concurrency is keyed on it. */
    readonly workspaceId: string
    /** 1 on the first start (job_outbox.attempts). */
    readonly attempt: number
    readonly maxAttempts: number
    /** True when a throw now ends the job as failed (no retry left). */
    readonly isFinalAttempt: boolean
    /** Aborted when the engine shuts down (the job is then handed back): stop at the next safe point. */
    readonly signal: AbortSignal
}

/**
 * The handler of one job name. Contract:
 *  - idempotent: a job may be delivered more than once (an engine crashed mid-run, a visibility timeout ran out, a retry). Re-running on a
 *    subject that is already done is a no-op;
 *  - a return completes the job (job_ack); a throw retries it with backoff (job_fail), unless it is a {@link PermanentJobError} or
 *    {@link BlockedCreditsError}, which archive it at once (job_archive);
 *  - `onFailed` runs once when the job ends as failed (final attempt or permanent error): write the failure the owner sees there.
 */
export interface JobHandler<N extends JobName = JobName> {
    readonly name: N
    handle(ctx: JobContext<N>): Promise<void>
    onFailed?(ctx: JobContext<N>, error: Error): Promise<void>
}

/** Base of the errors that end a job without retries. */
export class UnrecoverableJobError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "UnrecoverableJobError"
    }
}

/** Fail the job now, without retries (bad payload, a subject that no longer exists, a 4xx that will not change). */
export class PermanentJobError extends UnrecoverableJobError {
    constructor(message: string) {
        super(message)
        this.name = "PermanentJobError"
    }
}

/** The workspace has no credits left: the job fails with reason `blocked_credits` and is NOT retried (the owner tops up, then retries). */
export class BlockedCreditsError extends UnrecoverableJobError {
    constructor(message = BLOCKED_CREDITS) {
        super(message)
        this.name = "BlockedCreditsError"
    }
}

/** True for errors that end a job without retries. */
export const isUnrecoverable = (e: unknown): boolean => e instanceof UnrecoverableJobError
