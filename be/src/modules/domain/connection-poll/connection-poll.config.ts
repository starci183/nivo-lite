import type { EnvSource } from "@modules/platform/config"
import type { ConnectionPollOptions } from "./connection-poll.options"
import { pollOptionsOf } from "./poll-options.policy"

/**
 * Reads the poll scheduler options. Every interval and threshold is configurable: POLL_INTERVAL_HEALTHY (30m), POLL_INTERVAL_SILENT (5m),
 * POLL_INTERVAL_HOT (90s), POLL_WEBHOOK_SILENT_AFTER (6h), POLL_HOT_TTL (30m), POLL_JITTER_PERCENT (20), POLL_BACKOFF_BASE (30s), POLL_BACKOFF_CAP (30m),
 * POLL_BREAKER_THRESHOLD (5), POLL_BREAKER_COOLDOWN (10m), POLL_BREAKER_COOLDOWN_CAP (6h), POLL_UNAVAILABLE_RECHECK (24h), POLL_BATCH (50), POLL_LEASE (10m), POLL_MAX_INLINE_WAIT (5s)
 * and POLL_BACKFILL_CHUNK_PAGES (2). The limiter uses the Redis of the queues unless POLL_LIMITER_REDIS is false.
 */
export const parseConnectionPollConfig = (env: EnvSource): ConnectionPollOptions => pollOptionsOf(env)
