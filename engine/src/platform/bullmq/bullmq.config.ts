import type { EnvSource } from "../config/env.source";

/** What main.ts reads for the BullMQ jobs. `redisUrl` undefined = the capability is off (relay and workers do not start; the outbox keeps the jobs). */
export type BullmqOptions = {
  readonly redisUrl: string | undefined;
  /** Key prefix of every queue in Redis. */
  readonly prefix: string;
  /** Pause of the outbox relay after a pass that found less than a full batch. */
  readonly relayIntervalMs: number;
  /** Outbox rows claimed per relay pass. */
  readonly relayBatch: number;
  /** Jobs one worker process runs at a time, across all workspaces. */
  readonly concurrency: number;
  /** Jobs of ONE workspace running at a time across every worker process (a Redis semaphore), so one workspace cannot starve the others. */
  readonly workspaceConcurrency: number;
  /** How long running jobs get to finish on shutdown before they are handed back. */
  readonly shutdownGraceMs: number;
};

export const BULLMQ_OPTIONS = Symbol("BULLMQ_OPTIONS");

export const parseBullmqConfig = (env: EnvSource): BullmqOptions => ({
  redisUrl: env.optionalUrl("REDIS_URL", ["redis:", "rediss:"]),
  prefix: env.optional("JOBS_PREFIX") ?? "nivo",
  relayIntervalMs: env.int("JOBS_RELAY_MS", 1000, { min: 100, max: 60_000 }),
  relayBatch: env.int("JOBS_RELAY_BATCH", 50, { min: 1, max: 500 }),
  concurrency: env.int("JOBS_CONCURRENCY", 4, { min: 1, max: 64 }),
  workspaceConcurrency: env.int("JOBS_WORKSPACE_CONCURRENCY", 2, { min: 1, max: 64 }),
  shutdownGraceMs: env.int("ENGINE_SHUTDOWN_GRACE_MS", 30_000, { min: 0, max: 600_000 }),
});
