import type { EnvSource } from "@modules/platform/config"
import type { QueueOptions } from "./queue.options"

/** What the app's `main.ts` reads for the queues; the schedulers are the app root's choice. */
export type QueueConfig = Omit<QueueOptions, "schedulers">

/** Reads the queue options: pgmq lives in the primary Supabase PostgreSQL, so every value is a tunable with a literal default. */
export const parseQueueConfig = (env: EnvSource): QueueConfig => ({
    enabled: env.bool("QUEUE_ENABLED", true),
    concurrency: env.int("QUEUE_CONCURRENCY", 4),
    workspaceConcurrency: env.int("QUEUE_WORKSPACE_CONCURRENCY", 2),
    pollIntervalMs: env.duration("QUEUE_POLL_INTERVAL", 500),
    visibilityTimeoutMs: env.duration("QUEUE_VISIBILITY_TIMEOUT", 60000),
    shutdownGraceMs: env.duration("QUEUE_SHUTDOWN_GRACE", 30000),
})
