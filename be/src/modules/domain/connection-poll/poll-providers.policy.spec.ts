import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { REDIS_CLIENT } from "@modules/integrations/redis"
import type { RedisClient } from "@modules/integrations/redis"
import type { Provider } from "@nestjs/common"
import { POLL_LIMITER_STORE, POLL_RANDOM, POLL_REDIS, POLL_REDIS_PREFIX } from "./connection-poll.decorators"
import { MemoryPollLimiterStore } from "./memory-poll-limiter.adapter"
import { PollSchedulerService } from "./poll-scheduler.service"
import { PollScheduleService } from "./poll-schedule.service"
import { DEFAULT_POLL_SCHEDULE } from "./poll-schedule.policy"
import { PollSourceRegistryService } from "./poll-source-registry.service"
import { POLL_EXPORTED, pollProvidersOf, systemRandom } from "./poll-providers.policy"
import { RedisPollLimiterStore } from "./redis-poll-limiter.client"

const SUBJECT = Symbol("poll-providers.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { pollProvidersOf } }],
    }).compile()
    return moduleRef.get<typeof import("./poll-providers.policy")>(SUBJECT)
}

const options = { schedule: DEFAULT_POLL_SCHEDULE, redis: undefined }

/** The provider registered under a token, or undefined. */
const providerOf = (providers: ReadonlyArray<Provider>, key: symbol): Provider | undefined =>
    providers.find((provider) => typeof provider === "object" && "provide" in provider && provider.provide === key)

describe("poll-providers policy the exports", () => {
    it("exports what other modules call: the schedule, the scheduler, the source registry and the limiter", () => {
        expect(POLL_EXPORTED).toEqual(
            expect.arrayContaining([PollScheduleService, PollSchedulerService, PollSourceRegistryService]),
        )
    })

    it("provides everything it exports", async () => {
        const { pollProvidersOf } = await build()

        expect(pollProvidersOf(options)).toEqual(expect.arrayContaining([...POLL_EXPORTED]))
    })
})

describe("poll-providers policy the limiter store", () => {
    it("keeps the limiter in this process when the app declares no Redis", async () => {
        const { pollProvidersOf } = await build()

        expect(providerOf(pollProvidersOf(options), POLL_LIMITER_STORE)).toEqual({
            provide: POLL_LIMITER_STORE,
            useClass: MemoryPollLimiterStore,
        })
    })

    it("keeps the limiter in Redis, under the prefix of the app, when the app declares one", async () => {
        const { pollProvidersOf } = await build()
        const providers = pollProvidersOf({
            ...options,
            redis: { host: "localhost", port: 6379, db: 0, prefix: "nivo", password: undefined },
        })

        expect(providerOf(providers, POLL_LIMITER_STORE)).toEqual({
            provide: POLL_LIMITER_STORE,
            useClass: RedisPollLimiterStore,
        })
        expect(providerOf(providers, POLL_REDIS_PREFIX)).toEqual({ provide: POLL_REDIS_PREFIX, useValue: "nivo" })
        expect(providerOf(providers, POLL_REDIS)).toHaveProperty("useFactory")
    })

    it("opens the Redis connection of the app through the shared client", async () => {
        const { pollProvidersOf } = await build()
        const client = mock<RedisClient>()
        const runner = mock<ReturnType<RedisClient["open"]>>()
        client.open.mockReturnValue(runner)
        const provider = providerOf(
            pollProvidersOf({
                ...options,
                redis: { host: "cache", port: 6380, db: 2, prefix: "nivo", password: "secret" },
            }),
            POLL_REDIS,
        )

        expect(provider).toMatchObject({ inject: [REDIS_CLIENT] })
        if (provider === undefined || !("useFactory" in provider)) return expect(provider).toHaveProperty("useFactory")
        const opened: unknown = provider.useFactory(client)

        expect(opened).toBe(runner)
        expect(client.open).toHaveBeenCalledWith({ host: "cache", port: 6380, db: 2, password: "secret" })
    })
})

describe("poll-providers policy the random source", () => {
    it("jitters with a random number in [0, 1)", async () => {
        const { pollProvidersOf } = await build()

        const draw = systemRandom.next()

        expect(providerOf(pollProvidersOf(options), POLL_RANDOM)).toHaveProperty("useValue", systemRandom)
        expect(draw).toBeGreaterThanOrEqual(0)
        expect(draw).toBeLessThan(1)
    })
})
