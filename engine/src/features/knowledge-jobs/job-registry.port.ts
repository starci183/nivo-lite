/**
 * The thin contract this feature codes against until the BullMQ platform (engine/src/platform/bullmq, agent 1) lands:
 *   registry.register(name, handler)    one handler per job name;
 *   UnrecoverableError (from bullmq)     thrown by a handler to stop retries.
 * The platform provides its registry under JOB_REGISTRY (Symbol.for, so neither side has to import the other). When it uses another
 * token or class, only knowledge-jobs.module.ts changes.
 */
export type QueueJob<T = unknown> = {
  readonly id?: string;
  readonly name: string;
  readonly data: T;
  /** Attempts already failed before this run (BullMQ: 0 on the first run). */
  readonly attemptsMade: number;
  /** BullMQ job options, when the platform passes them: `attempts` lets a handler know its last try. */
  readonly opts?: { readonly attempts?: number };
};

export type JobFn = (job: QueueJob) => Promise<void>;

export interface JobRegistry {
  register(name: string, handler: JobFn): void;
}

export const JOB_REGISTRY = Symbol.for("nivo.engine.job-registry");

/** The queue the knowledge jobs live on (job_outbox.queue, knowledge_enqueue_source writes 'knowledge'). */
export const KNOWLEDGE_QUEUE = "knowledge";

export const KNOWLEDGE_JOBS = { index: "knowledge.index", facts: "knowledge.facts", reembed: "knowledge.reembed" } as const;
