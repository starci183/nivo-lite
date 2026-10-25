import type { EnvSource } from "@modules/platform/config"
import type { QueueOptions } from "./queue.options"

/** What the app's `main.ts` reads for the queues; the schedulers are the app root's choice. */
export type QueueConfig = Omit<QueueOptions, "schedulers">

/** Reads the queue options: where the declared Redis is, and the tunables with literal defaults. */
export const parseQueueConfig = (env: EnvSource): QueueConfig => ({
    enabled: env.bool("QUEUE_ENABLED", true),
    redisHost: env.optional("QUEUE_REDIS_HOST") ?? "localhost",
    redisPort: env.int("QUEUE_REDIS_PORT", 6379),
    redisDb: env.int("QUEUE_REDIS_DB", 0),
    redisPassword: env.has("QUEUE_REDIS_PASSWORD") ? env.secret("QUEUE_REDIS_PASSWORD") : undefined,
    prefix: env.optional("QUEUE_REDIS_PREFIX") ?? "nivo",
    concurrency: env.int("QUEUE_CONCURRENCY", 4),
    workspaceConcurrency: env.int("QUEUE_WORKSPACE_CONCURRENCY", 2),
    relayIntervalMs: env.duration("QUEUE_RELAY_INTERVAL", 500),
    relayBatch: env.int("QUEUE_RELAY_BATCH", 50),
    reconcileAfterMs: env.duration("QUEUE_RECONCILE_AFTER", 15_000),
    visibilityTimeoutMs: env.duration("QUEUE_VISIBILITY_TIMEOUT", 60000),
    shutdownGraceMs: env.duration("QUEUE_SHUTDOWN_GRACE", 30000),
})
