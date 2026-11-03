import { EnvSource } from "@modules/platform/config"
import { parseConnectionPollConfig } from "./connection-poll.config"
import { DEFAULT_POLL_SCHEDULE } from "./poll-schedule.policy"

describe("parseConnectionPollConfig", () => {
    it("defaults to 30 minutes while the webhook delivers, 5 while it is silent and 90 seconds while hot", () => {
        const { schedule } = parseConnectionPollConfig(new EnvSource({ QUEUE_ENABLED: "false" }))

        expect(schedule).toEqual(DEFAULT_POLL_SCHEDULE)
        expect([schedule.healthyIntervalMs, schedule.silentIntervalMs, schedule.hotIntervalMs]).toEqual([1_800_000, 300_000, 90_000])
    })

    it("reads every interval, threshold and cap from the environment", () => {
        const env = new EnvSource({
            QUEUE_ENABLED: "false",
            POLL_INTERVAL_HEALTHY: "1h",
            POLL_INTERVAL_SILENT: "10m",
            POLL_INTERVAL_HOT: "2m",
            POLL_WEBHOOK_SILENT_AFTER: "12h",
            POLL_HOT_TTL: "1h",
            POLL_JITTER_PERCENT: "10",
            POLL_BACKOFF_BASE: "1m",
            POLL_BACKOFF_CAP: "1h",
            POLL_BREAKER_THRESHOLD: "3",
            POLL_BREAKER_COOLDOWN: "20m",
            POLL_BREAKER_COOLDOWN_CAP: "12h",
            POLL_BATCH: "10",
            POLL_LEASE: "5m",
            POLL_MAX_INLINE_WAIT: "2s",
            POLL_BACKFILL_CHUNK_PAGES: "4",
        })

        expect(parseConnectionPollConfig(env).schedule).toEqual({
            healthyIntervalMs: 3_600_000,
            silentIntervalMs: 600_000,
            hotIntervalMs: 120_000,
            webhookSilentAfterMs: 43_200_000,
            hotTtlMs: 3_600_000,
            jitterRatio: 0.1,
            backoffBaseMs: 60_000,
            backoffCapMs: 3_600_000,
            breakerThreshold: 3,
            breakerCooldownMs: 1_200_000,
            breakerCooldownCapMs: 43_200_000,
            batchSize: 10,
            leaseMs: 300_000,
            maxInlineWaitMs: 2000,
            backfillChunkPages: 4,
        })
    })

    it("keeps the limiter in the process when Redis is switched off", () => {
        expect(parseConnectionPollConfig(new EnvSource({ POLL_LIMITER_REDIS: "false" })).redis).toBeUndefined()
        expect(parseConnectionPollConfig(new EnvSource({ QUEUE_ENABLED: "false" })).redis).toBeUndefined()
    })

    it("shares the Redis of the queues with the limiter by default", () => {
        expect(parseConnectionPollConfig(new EnvSource({})).redis).toEqual({
            host: "localhost",
            port: 6379,
            db: 0,
            prefix: "nivo",
            password: undefined,
        })
    })

    it("reads the address, the prefix and the password of that Redis", () => {
        const env = new EnvSource({
            QUEUE_REDIS_HOST: "redis.internal",
            QUEUE_REDIS_PORT: "6380",
            QUEUE_REDIS_DB: "2",
            QUEUE_REDIS_PREFIX: "acme",
            QUEUE_REDIS_PASSWORD: "p".repeat(12),
        })

        expect(parseConnectionPollConfig(env).redis).toEqual({
            host: "redis.internal",
            port: 6380,
            db: 2,
            prefix: "acme",
            password: "p".repeat(12),
        })
    })
})
