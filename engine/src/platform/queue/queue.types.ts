/** One row of `engine_jobs` as the worker sees it after a claim. */
export type EngineJob = {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly kind: string;
  readonly payload: Record<string, unknown>;
  readonly attempts: number;
  readonly max_attempts: number;
  readonly locked_until: string | null;
};

/** What a handler stores as the job result. */
export type JobResult = Record<string, unknown>;

/** A handler for one job kind. It must be safe to run twice for the same job (a lease can expire mid-run). */
export interface JobHandler {
  readonly kind: string;
  run(job: EngineJob, signal: AbortSignal): Promise<JobResult>;
}

/** Fail the job without retries (bad payload, a 4xx that will not change). */
export class PermanentJobError extends Error {}

/** Fail this attempt and retry after `seconds` instead of the default backoff. */
export class RetryJobError extends Error {
  constructor(message: string, readonly seconds: number) {
    super(message);
  }
}

export const JOB_HANDLERS = Symbol("JOB_HANDLERS");
export const QUEUE_OPTIONS = Symbol("QUEUE_OPTIONS");
