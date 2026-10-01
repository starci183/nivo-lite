import { hostname } from "node:os";
import type { EnvSource } from "../config/env.source";

export type QueueOptions = {
  readonly workerId: string;
  readonly version: string;
  readonly pollMs: number;
  readonly concurrency: number;
  readonly leaseSeconds: number;
  readonly shutdownGraceMs: number;
};

export const parseQueueConfig = (env: EnvSource, version: string): QueueOptions => ({
  workerId: env.optional("ENGINE_WORKER_ID") ?? `${hostname()}-${process.pid}`,
  version,
  pollMs: env.int("ENGINE_POLL_MS", 2000, { min: 200, max: 60_000 }),
  concurrency: env.int("ENGINE_CONCURRENCY", 4, { min: 1, max: 64 }),
  leaseSeconds: env.int("ENGINE_LEASE_SECONDS", 60, { min: 15, max: 3600 }),
  shutdownGraceMs: env.int("ENGINE_SHUTDOWN_GRACE_MS", 30_000, { min: 0, max: 600_000 }),
});
