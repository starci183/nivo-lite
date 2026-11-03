import type { EnvSource } from "@modules/platform/config"
import type { ConnectionPollOptions, PollRedisOptions } from "./poll-schedule.contracts"
import { DEFAULT_POLL_SCHEDULE } from "./poll-schedule.policy"

/** The Redis of the queues, which the limiter shares; undefined when the limiter is kept in this process. */
const redisOf = (env: EnvSource): PollRedisOptions | undefined =>
    env.bool("POLL_LIMITER_REDIS", env.bool("QUEUE_ENABLED", true))
        ? {
              host: env.optional("QUEUE_REDIS_HOST") ?? "localhost",
              port: env.int("QUEUE_REDIS_PORT", 6379),
              db: env.int("QUEUE_REDIS_DB", 0),
              prefix: env.optional("QUEUE_REDIS_PREFIX") ?? "nivo",
              password: env.has("QUEUE_REDIS_PASSWORD") ? env.secret("QUEUE_REDIS_PASSWORD").reveal() : undefined,
          }
        : undefined

/**
 * Reads the poll scheduler options. Every interval and threshold is configurable: POLL_INTERVAL_HEALTHY (30m), POLL_INTERVAL_SILENT (5m),
 * POLL_INTERVAL_HOT (90s), POLL_WEBHOOK_SILENT_AFTER (6h), POLL_HOT_TTL (30m), POLL_JITTER_PERCENT (20), POLL_BACKOFF_BASE (30s), POLL_BACKOFF_CAP (30m),
 * POLL_BREAKER_THRESHOLD (5), POLL_BREAKER_COOLDOWN (10m), POLL_BREAKER_COOLDOWN_CAP (6h), POLL_UNAVAILABLE_RECHECK (24h), POLL_BATCH (50), POLL_LEASE (10m), POLL_MAX_INLINE_WAIT (5s)
 * and POLL_BACKFILL_CHUNK_PAGES (2). The limiter uses the Redis of the queues unless POLL_LIMITER_REDIS is false.
 */
export const parseConnectionPollConfig = (env: EnvSource): ConnectionPollOptions => {
    const d = DEFAULT_POLL_SCHEDULE
    return {
        schedule: {
            healthyIntervalMs: env.duration("POLL_INTERVAL_HEALTHY", d.healthyIntervalMs),
            silentIntervalMs: env.duration("POLL_INTERVAL_SILENT", d.silentIntervalMs),
            hotIntervalMs: env.duration("POLL_INTERVAL_HOT", d.hotIntervalMs),
            webhookSilentAfterMs: env.duration("POLL_WEBHOOK_SILENT_AFTER", d.webhookSilentAfterMs),
            hotTtlMs: env.duration("POLL_HOT_TTL", d.hotTtlMs),
            jitterRatio: env.int("POLL_JITTER_PERCENT", d.jitterRatio * 100) / 100,
            backoffBaseMs: env.duration("POLL_BACKOFF_BASE", d.backoffBaseMs),
            backoffCapMs: env.duration("POLL_BACKOFF_CAP", d.backoffCapMs),
            breakerThreshold: env.int("POLL_BREAKER_THRESHOLD", d.breakerThreshold),
            breakerCooldownMs: env.duration("POLL_BREAKER_COOLDOWN", d.breakerCooldownMs),
            breakerCooldownCapMs: env.duration("POLL_BREAKER_COOLDOWN_CAP", d.breakerCooldownCapMs),
            unavailableRecheckMs: env.duration("POLL_UNAVAILABLE_RECHECK", d.unavailableRecheckMs),
            batchSize: env.int("POLL_BATCH", d.batchSize),
            leaseMs: env.duration("POLL_LEASE", d.leaseMs),
            maxInlineWaitMs: env.duration("POLL_MAX_INLINE_WAIT", d.maxInlineWaitMs),
            backfillChunkPages: env.int("POLL_BACKFILL_CHUNK_PAGES", d.backfillChunkPages),
        },
        redis: redisOf(env),
    }
}
