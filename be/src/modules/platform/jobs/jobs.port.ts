import type { EntityManager } from "typeorm"
import type { JobTick } from "./job-ticks.contracts"
import type {
    AdvanceWrite,
    ClaimedJob,
    ClaimParams,
    ClaimResult,
    ClaimRetryDelay,
    FailWrite,
    FailedJobEffect,
    JobEffect,
    GuardedWrite,
    RunKey,
} from "./jobs.contracts"
import type { FencedProcessor } from "./fenced.processor"

/** A domain write performed in the transaction that holds the current job's fence. */
export type JobFenceAction = (tx: EntityManager) => Promise<void>

/** The one door to the job row; `platform/jobs` implements it and nothing else writes the table. */
export interface JobClaims {
    /** Claims the delivery in one atomic statement and bumps the fencing token; null when the job is done or another worker holds a live claim. */
    claim(params: ClaimParams): Promise<ClaimResult>
    /** Null only for a confirmed completed job; otherwise the seconds before a refused delivery may try its claim again. */
    retryAfterSeconds(jobKey: string): Promise<ClaimRetryDelay>
    /** Records a finished step; throws `JobFencedOut` when the token is stale. */
    advance(write: AdvanceWrite): Promise<void>
    /** Completes the job; throws `JobFencedOut` when the token is stale. */
    complete(write: GuardedWrite): Promise<void>
    /** Fails the job so the queue can retry it; throws `JobFencedOut` when the token is stale. */
    fail(write: FailWrite): Promise<void>
    /** Holds the live job fence across domain effects so a replacement claim cannot overtake them. */
    withFence<T>(job: ClaimedJob, work: JobEffect<T>): Promise<T>
    /** Holds a failed delivery fence only when no successor worker is live. */
    withFailedFence(jobKey: string, work: FailedJobEffect): Promise<void>
    /** The idempotency key of one step of this claim: `<jobId>:<step>:<fencingToken>`. */
    runKey(job: ClaimedJob, step: string): RunKey
}

/** One external effect of a job. */
export interface JobStep {
    /** Performs the effect of the step for the claimed job. */
    run(job: ClaimedJob): Promise<void>
}

/** Where a job module registers its processor. */
export interface JobProcessorRegistry {
    /** Subscribes the processor to its queue. */
    add(processor: FencedProcessor): void
}

/** Starts the recurring cron jobs of the ticks; the package that fires them stays behind this port. */
export interface JobTickScheduler {
    /** Registers a cron job named after the tick that calls `onTick` on the tick's schedule; a firing that throws goes to `onError`. */
    schedule(tick: JobTick, onTick: () => Promise<void>, onError: (cause: unknown) => void): void
}
