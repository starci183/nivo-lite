import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { pollOptionsOf } from "./poll-options.policy"
import { DEFAULT_POLL_SCHEDULE } from "./poll-schedule.policy"

const SUBJECT = Symbol("poll-options.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: pollOptionsOf }],
    }).compile()
    return moduleRef.get<typeof pollOptionsOf>(SUBJECT)
}

describe("pollOptionsOf the scheduler", () => {
    it("defaults to 30 minutes while the webhook delivers, 5 while it is silent and 90 seconds while hot", async () => {
        const optionsOf = await build()

        const { schedule } = optionsOf(new EnvSource({ QUEUE_ENABLED: "false" }))

        expect(schedule).toEqual(DEFAULT_POLL_SCHEDULE)
        expect([schedule.healthyIntervalMs, schedule.silentIntervalMs, schedule.hotIntervalMs]).toEqual([
            1_800_000, 300_000, 90_000,
        ])
    })

    it("reads every interval, threshold and cap from the environment", async () => {
        const optionsOf = await build()
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
            POLL_UNAVAILABLE_RECHECK: "12h",
            POLL_BATCH: "10",
            POLL_LEASE: "5m",
            POLL_MAX_INLINE_WAIT: "2s",
            POLL_BACKFILL_CHUNK_PAGES: "4",
        })

        expect(optionsOf(env).schedule).toEqual({
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
            unavailableRecheckMs: 43_200_000,
            batchSize: 10,
            leaseMs: 300_000,
            maxInlineWaitMs: 2000,
            backfillChunkPages: 4,
        })
    })
})

describe("pollOptionsOf the limiter Redis", () => {
    it("keeps the limiter in the process when Redis is switched off", async () => {
        const optionsOf = await build()

        expect(optionsOf(new EnvSource({ POLL_LIMITER_REDIS: "false" })).redis).toBeUndefined()
        expect(optionsOf(new EnvSource({ QUEUE_ENABLED: "false" })).redis).toBeUndefined()
    })

    it("shares the Redis of the queues with the limiter by default", async () => {
        const optionsOf = await build()

        expect(optionsOf(new EnvSource({})).redis).toEqual({
            host: "localhost",
            port: 6379,
            db: 0,
            prefix: "nivo",
            password: undefined,
        })
    })

    it("reads the address, the prefix and the password of that Redis", async () => {
        const optionsOf = await build()
        const env = new EnvSource({
            QUEUE_REDIS_HOST: "redis.internal",
            QUEUE_REDIS_PORT: "6380",
            QUEUE_REDIS_DB: "2",
            QUEUE_REDIS_PREFIX: "acme",
            QUEUE_REDIS_PASSWORD: "p".repeat(12),
        })

        expect(optionsOf(env).redis).toEqual({
            host: "redis.internal",
            port: 6380,
            db: 2,
            prefix: "acme",
            password: "p".repeat(12),
        })
    })
})
