import type { Provider } from "@nestjs/common"
import { POLL_LIMITER_STORE, POLL_RANDOM } from "./connection-poll.decorators"
import { ConnectionPollModule } from "./connection-poll.module"
import { MemoryPollLimiterStore } from "./memory-poll-limiter.store"
import { PollScheduleService } from "./poll-schedule.service"
import { PollSchedulerService } from "./poll-scheduler.service"
import { PollSourceRegistry } from "./poll-source-registry.service"
import { DEFAULT_POLL_SCHEDULE } from "./poll-schedule.policy"
import { RedisPollLimiterStore } from "./redis-poll-limiter.store"

const schedule = DEFAULT_POLL_SCHEDULE

/** The provider registered under a token, or undefined. */
const providerOf = (registered: ReturnType<typeof ConnectionPollModule.register>, token: symbol): Provider | undefined =>
    registered.providers?.find((provider) => typeof provider === "object" && "provide" in provider && provider.provide === token)

describe("ConnectionPollModule", () => {
    it("exports what other modules call: the schedule, the scheduler, the source registry and the limiter", () => {
        const registered = ConnectionPollModule.register({ schedule, redis: undefined })

        expect(registered.exports).toEqual(
            expect.arrayContaining([PollScheduleService, PollSchedulerService, PollSourceRegistry]),
        )
    })

    it("keeps the limiter in this process when the app declares no Redis", () => {
        const store = providerOf(ConnectionPollModule.register({ schedule, redis: undefined }), POLL_LIMITER_STORE)

        expect(store).toEqual({ provide: POLL_LIMITER_STORE, useClass: MemoryPollLimiterStore })
    })

    it("keeps the limiter in Redis, under the prefix of the app, when the app declares one", () => {
        const registered = ConnectionPollModule.register({
            schedule,
            redis: { host: "localhost", port: 6379, db: 0, prefix: "nivo", password: undefined },
        })
        const store = providerOf(registered, POLL_LIMITER_STORE)

        const made: unknown = Reflect.apply(Reflect.get(Object(store), "useFactory"), undefined, [])

        expect(made).toBeInstanceOf(RedisPollLimiterStore)
    })

    it("jitters with a random number in [0, 1)", () => {
        const random = providerOf(ConnectionPollModule.register({ schedule, redis: undefined }), POLL_RANDOM)

        const draw: unknown = Reflect.apply(Reflect.get(Object(random), "useValue"), undefined, [])

        expect(draw).toBeGreaterThanOrEqual(0)
        expect(draw).toBeLessThan(1)
    })
})
