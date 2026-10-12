import { UnrecoverableError } from "bullmq";
import { BLOCKED_CREDITS, type JobName, type JobPayloads } from "./contracts";

/** One delivery of a job as a handler receives it. */
export type JobContext<N extends JobName = JobName> = {
  /** The BullMQ job id (the outbox dedupe key, see bullmqJobId). */
  readonly id: string;
  readonly name: N;
  readonly payload: JobPayloads[N];
  /** The workspace the job belongs to (payload.workspaceId); the per-workspace concurrency is keyed on it. */
  readonly workspaceId: string;
  /** 1 on the first delivery. */
  readonly attempt: number;
  readonly maxAttempts: number;
  /** True when a throw now ends the job as failed (no retry left). */
  readonly isFinalAttempt: boolean;
  /** Aborted when the worker shuts down (the job is then re-delivered later): stop at the next safe point. */
  readonly signal: AbortSignal;
  /** BullMQ progress (0-100), for operators; the product shows knowledge_sources.progress, which the handler writes itself. */
  progress(percent: number): Promise<void>;
};

/**
 * The handler of one job name. Contract:
 *  - idempotent: a job may be delivered more than once (relay re-add after a crash, stalled job, retry). Re-running on a subject that is
 *    already done is a no-op;
 *  - a return completes the job; a throw retries it with the policy's backoff (bullmq.policy.ts), unless it is a {@link PermanentJobError}
 *    or {@link BlockedCreditsError}, which fail it at once;
 *  - `onFailed` runs once when the job ends as failed (final attempt or permanent error): write the failure the owner sees there.
 */
export interface BullJobHandler<N extends JobName = JobName> {
  readonly name: N;
  handle(ctx: JobContext<N>): Promise<void>;
  onFailed?(ctx: JobContext<N>, error: Error): Promise<void>;
}

/** Fail the job now, without retries (bad payload, a subject that no longer exists, a 4xx that will not change). */
export class PermanentJobError extends UnrecoverableError {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}

/** The workspace has no credits left: the job fails with reason `blocked_credits` and is NOT retried (the owner tops up, then retries). */
export class BlockedCreditsError extends UnrecoverableError {
  constructor(message = BLOCKED_CREDITS) {
    super(message);
    this.name = "BlockedCreditsError";
  }
}

/** True for errors that end a job without retries. */
export const isUnrecoverable = (e: unknown): boolean => e instanceof UnrecoverableError;
