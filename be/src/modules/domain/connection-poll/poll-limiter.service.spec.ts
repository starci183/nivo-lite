import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { CONNECTION_POLL_OPTIONS, POLL_LIMITER_STORE } from "./connection-poll.decorators"
import { ConnectionPollError, ConnectionPollErrorCode } from "./errors/connection-poll.error"
import type { PollLimiterStore } from "./poll-limiter.contracts"
import { PollLimiterService } from "./poll-limiter.service"
import { DEFAULT_POLL_SCHEDULE } from "./poll-schedule.policy"

const limits = { ratePerSecond: 2, burst: 2, concurrency: 1 }

const build = async () => {
    const store = mock<PollLimiterStore>()
    const timer = mock<Timer>()
    timer.schedule.mockImplementation((callback) => {
        callback()
        return () => undefined
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            PollLimiterService,
            { provide: CLOCK, useValue: new FakeClock("2026-11-04T10:00:00.000Z") },
            { provide: TIMER, useValue: timer },
            { provide: POLL_LIMITER_STORE, useValue: store },
            { provide: CONNECTION_POLL_OPTIONS, useValue: { schedule: DEFAULT_POLL_SCHEDULE, redis: undefined } },
        ],
    }).compile()
    return { service: moduleRef.get(PollLimiterService), store, timer }
}

describe("PollLimiterService enter", () => {
    it("takes a slot of the provider for the connection and gives it back on release", async () => {
        const { service, store } = await build()
        store.enter.mockResolvedValue(true)

        const slot = await service.enter("sepay", "c-1", limits)
        await slot?.release()

        expect(store.enter).toHaveBeenCalledWith("sepay", "c-1", 1, DEFAULT_POLL_SCHEDULE.leaseMs, Date.parse("2026-11-04T10:00:00.000Z"))
        expect(store.leave).toHaveBeenCalledWith("sepay", "c-1")
    })

    it("answers nothing when every slot is taken", async () => {
        const { service, store } = await build()
        store.enter.mockResolvedValue(false)

        await expect(service.enter("sepay", "c-1", limits)).resolves.toBeUndefined()
    })
})

describe("PollLimiterService pass", () => {
    it("lets a call through at once when the bucket holds a token", async () => {
        const { service, store, timer } = await build()
        store.take.mockResolvedValue({ allowed: true, waitMs: 0 })

        await expect(service.pass("sepay", "c-1", limits)).resolves.toBeUndefined()

        expect(store.take).toHaveBeenCalledWith("sepay:c-1", limits, Date.parse("2026-11-04T10:00:00.000Z"))
        expect(timer.schedule).not.toHaveBeenCalled()
    })

    it("waits for a token that comes within the inline wait and then goes on", async () => {
        const { service, store, timer } = await build()
        store.take.mockResolvedValueOnce({ allowed: false, waitMs: 400 }).mockResolvedValueOnce({ allowed: true, waitMs: 0 })

        await service.pass("sepay", "c-1", limits)

        expect(timer.schedule).toHaveBeenCalledWith(expect.any(Function), 400)
        expect(store.take).toHaveBeenCalledTimes(2)
    })

    it("ends the poll with the wait named when the token is further away than the inline wait", async () => {
        const { service, store } = await build()
        store.take.mockResolvedValue({ allowed: false, waitMs: DEFAULT_POLL_SCHEDULE.maxInlineWaitMs + 1 })

        const failure = await service.pass("sepay", "c-1", limits).catch((cause: unknown) => cause)

        expect(failure).toBeInstanceOf(ConnectionPollError)
        expect(failure).toMatchObject({
            code: ConnectionPollErrorCode.Deferred,
            params: { waitMs: DEFAULT_POLL_SCHEDULE.maxInlineWaitMs + 1 },
        })
    })

    it("gives up after waiting three times for a bucket that stays empty", async () => {
        const { service, store, timer } = await build()
        store.take.mockResolvedValue({ allowed: false, waitMs: 100 })

        await expect(service.pass("sepay", "c-1", limits)).rejects.toBeInstanceOf(ConnectionPollError)

        expect(timer.schedule).toHaveBeenCalledTimes(3)
        expect(store.take).toHaveBeenCalledTimes(4)
    })
})
