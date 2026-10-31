import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { Timer } from "@modules/platform/retry"
import { REALTIME_LISTENER, REALTIME_MANAGERS, REALTIME_TIMER } from "./realtime.decorators"
import type { NotificationListener } from "./postgres-listener.port"
import { RealtimeError, RealtimeErrorCode } from "./errors/realtime.error"
import { PostgresRealtimeHubService } from "./postgres-realtime-hub.service"
import { CATCH_UP_ROWS, NOTIFY_CHANNEL, RECONNECT_DELAY_MS } from "./realtime.contracts"
import { RealtimeLogEvent } from "./realtime.log-events"
import {
    SELECT_EVENT,
    SELECT_MISSED_EVENTS,
    SELECT_TOPIC_HIGHEST_SEQ,
} from "@tests/fixtures/builders/realtime-statements.builder"
import {
    dropAndResume,
    frameOf,
    gateOf,
    notification,
    reloadingHubWorld,
    rowOf,
    settle,
    topicOf,
} from "@tests/fixtures/builders/realtime-reloading-hub.builder"

/** The hub on a scripted database, built the way Nest builds it from its constructor dependencies. */
const build = async (watermarks: Readonly<Record<string, number>> = {}) => {
    const listener = mock<NotificationListener>()
    const timer = mock<Timer>()
    const logger = mock<Logger>()
    const world = reloadingHubWorld(watermarks, listener, timer)
    const managers = [world.em]
    const moduleRef = await Test.createTestingModule({
        providers: [
            PostgresRealtimeHubService,
            { provide: REALTIME_MANAGERS, useValue: managers },
            { provide: REALTIME_LISTENER, useValue: listener },
            { provide: LOGGER, useValue: logger },
            { provide: REALTIME_TIMER, useValue: timer },
        ],
    }).compile()
    const hub = moduleRef.get(PostgresRealtimeHubService)
    await hub.onModuleInit()
    return { hub, listener, logger, ...world }
}

describe("PostgresRealtimeHubService start and stop", () => {
    it("sends the probe of a new connection from its own session, so it proves delivery across sessions", async () => {
        const { em, handlers } = await build()

        await handlers.current.probe("probe:abc")

        expect(em.query).toHaveBeenCalledWith('SELECT * FROM "pg_catalog"."pg_notify"($1, $2)', [
            NOTIFY_CHANNEL,
            "probe:abc",
        ])
    })

    it("stops the listener when the app shuts down", async () => {
        const { hub, listener } = await build()

        await hub.onModuleDestroy()

        expect(listener.stop).toHaveBeenCalledTimes(1)
    })

    it("ends a reader still waiting when the app shuts down, so nothing holds a handle", async () => {
        const { hub } = await build()
        const reader = hub.subscribe(topicOf("t:bye"))[Symbol.asyncIterator]()
        const pending = reader.next()

        await hub.onModuleDestroy()

        await expect(pending).resolves.toEqual({ done: true, value: undefined })
    })

    it("lets a delivery already queued settle before it is destroyed", async () => {
        const { hub, table, answers, handlers, reads } = await build()
        table.push(rowOf(1, "t:end", frameOf(1)))
        hub.subscribe(topicOf("t:end"))[Symbol.asyncIterator]()
        await settle()
        const gate = gateOf()
        let delivered = false
        const answer = answers.get(SELECT_EVENT)
        answers.set(SELECT_EVENT, async (args) => {
            await gate.opened
            delivered = true
            return answer?.(args)
        })
        handlers.current.notify(notification("t:end", 1))

        let deliveredWhenDestroyed = false
        const destroyed = hub.onModuleDestroy().then(() => {
            deliveredWhenDestroyed = delivered
        })
        gate.open()
        await destroyed

        expect(deliveredWhenDestroyed).toBe(true)
        expect(reads).toContainEqual({ key: SELECT_EVENT, args: ["1"] })
    })
})

describe("PostgresRealtimeHubService reload bookkeeping", () => {
    it("keeps notifications held after a failed reload, retries with the Timer, then delivers outage frames once", async () => {
        const { hub, answers, table, logger, handlers, scheduled, reads } = await build({ "t:fail": 10 })
        const reader = hub.subscribe(topicOf("t:fail"))[Symbol.asyncIterator]()
        await settle()
        const reloadAnswer = answers.get(SELECT_MISSED_EVENTS)
        answers.set(SELECT_MISSED_EVENTS, () =>
            Promise.reject(new RealtimeError({ code: RealtimeErrorCode.ListenDropped })),
        )
        table.push(rowOf(11, "t:fail", frameOf(11)), rowOf(12, "t:fail", frameOf(12)))

        handlers.current.lost()
        handlers.current.notify(notification("t:fail", 12))
        handlers.current.resumed()
        await settle()

        expect(reads).not.toContainEqual({ key: SELECT_EVENT, args: ["12"] })
        expect(logger.error).toHaveBeenCalledWith(RealtimeLogEvent.CatchUpFailed, expect.any(Error))
        expect(scheduled[0]?.delayMs).toBe(RECONNECT_DELAY_MS)
        answers.set(SELECT_MISSED_EVENTS, (args) => reloadAnswer?.(args))
        scheduled[0]?.callback()
        await settle()

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(11) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(12) })
        await reader.return?.()
        await expect(reader.next()).resolves.toEqual({ done: true, value: undefined })
    })

    it("cancels a reload retry when destroyed, including a callback already dispatched by the Timer", async () => {
        const { hub, answers, handlers, scheduled, reads } = await build()
        hub.subscribe(topicOf("t:stop"))[Symbol.asyncIterator]()
        await settle()
        answers.set(SELECT_MISSED_EVENTS, () =>
            Promise.reject(new RealtimeError({ code: RealtimeErrorCode.ListenDropped })),
        )
        await dropAndResume(handlers)

        await hub.onModuleDestroy()
        reads.length = 0
        scheduled[0]?.callback()
        await settle()

        expect(scheduled[0]?.cancelled).toBe(true)
        expect(reads).toEqual([])
    })

    it("does not let a stale retry release notifications belonging to a newer loss", async () => {
        const { hub, answers, table, handlers, scheduled, reads } = await build()
        const reader = hub.subscribe(topicOf("t:retry-flap"))[Symbol.asyncIterator]()
        await settle()
        const reloadAnswer = answers.get(SELECT_MISSED_EVENTS)
        answers.set(SELECT_MISSED_EVENTS, () =>
            Promise.reject(new RealtimeError({ code: RealtimeErrorCode.ListenDropped })),
        )
        await dropAndResume(handlers)
        handlers.current.lost()
        handlers.current.notify(notification("t:retry-flap", 1))
        answers.set(SELECT_MISSED_EVENTS, (args) => reloadAnswer?.(args))
        reads.length = 0

        scheduled[0]?.callback()
        await settle()

        expect(reads).toEqual([])
        expect(scheduled[0]?.cancelled).toBe(true)
        table.push(rowOf(1, "t:retry-flap", frameOf(1)))
        handlers.current.resumed()
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await reader.return?.()
    })
})

describe("PostgresRealtimeHubService reload bookkeeping (part 2)", () => {
    it("does not schedule a failed in-flight reload after shutdown", async () => {
        const { hub, answers, handlers, scheduled } = await build()
        hub.subscribe(topicOf("t:shutdown"))[Symbol.asyncIterator]()
        await settle()
        const gate = gateOf()
        answers.set(SELECT_MISSED_EVENTS, async () => {
            await gate.opened
            throw new RealtimeError({ code: RealtimeErrorCode.ReplayFailed })
        })
        await dropAndResume(handlers)

        const stopped = hub.onModuleDestroy()
        gate.open()
        await stopped

        expect(scheduled).toHaveLength(0)
    })

    it("leaves a failed in-flight reload to the newer generation rather than scheduling its stale retry", async () => {
        const { hub, answers, handlers, scheduled } = await build()
        const reader = hub.subscribe(topicOf("t:older"))[Symbol.asyncIterator]()
        await settle()
        const gate = gateOf()
        answers.set(SELECT_MISSED_EVENTS, async () => {
            await gate.opened
            throw new RealtimeError({ code: RealtimeErrorCode.ReplayFailed })
        })
        await dropAndResume(handlers)
        handlers.current.lost()
        gate.open()
        await settle()

        expect(scheduled).toHaveLength(0)
        await reader.return?.()
    })

    it("does not drain a successful in-flight reload after shutdown", async () => {
        const { hub, answers, handlers, scheduled, reads } = await build()
        hub.subscribe(topicOf("t:closing"))[Symbol.asyncIterator]()
        await settle()
        const gate = gateOf()
        answers.set(SELECT_MISSED_EVENTS, async () => {
            await gate.opened
            return []
        })
        await dropAndResume(handlers)
        handlers.current.notify(notification("t:closing", 1))

        const stopped = hub.onModuleDestroy()
        gate.open()
        await stopped

        expect(reads).not.toContainEqual({ key: SELECT_EVENT, args: ["1"] })
        expect(scheduled).toHaveLength(0)
    })
})

describe("PostgresRealtimeHubService reload bookkeeping (part 3)", () => {
    it("forgets the cursor of a topic nobody follows any more, so a new subscription starts from where the topic stands", async () => {
        const { hub, answers, table, handlers, reads } = await build({ "t:gone": 0 })
        const gone = hub.subscribe(topicOf("t:gone"))[Symbol.asyncIterator]()
        await settle()
        table.push(rowOf(5, "t:gone", frameOf(5)))
        handlers.current.notify(notification("t:gone", 5))
        await expect(gone.next()).resolves.toEqual({ done: false, value: frameOf(5) })
        await gone.return?.()
        answers.set(SELECT_TOPIC_HIGHEST_SEQ, () => [{ seq: "7" }])
        const again = hub.subscribe(topicOf("t:gone"))[Symbol.asyncIterator]()
        await settle()

        await dropAndResume(handlers)

        expect(reads.at(-1)).toEqual({ key: SELECT_MISSED_EVENTS, args: [["t:gone"], [7], CATCH_UP_ROWS] })
        await again.return?.()
    })

    it("starts from zero when the table answers nothing for a new topic", async () => {
        const { hub, answers, handlers, reads } = await build()
        answers.set(SELECT_TOPIC_HIGHEST_SEQ, () => [])
        const reader = hub.subscribe(topicOf("t:new"))[Symbol.asyncIterator]()
        await settle()

        await dropAndResume(handlers)

        expect(reads.at(-1)).toEqual({ key: SELECT_MISSED_EVENTS, args: [["t:new"], [0], CATCH_UP_ROWS] })
        await reader.return?.()
    })

    it("reloads from zero while a subscription is still reading its starting point", async () => {
        const { hub, answers, handlers, reads } = await build()
        const gate = gateOf()
        answers.set(SELECT_TOPIC_HIGHEST_SEQ, async () => {
            await gate.opened
            return [{ seq: "3" }]
        })
        const reader = hub.subscribe(topicOf("t:pending"))[Symbol.asyncIterator]()
        reads.length = 0

        await dropAndResume(handlers)
        gate.open()
        await settle()

        expect(reads).toContainEqual({ key: SELECT_MISSED_EVENTS, args: [["t:pending"], [0], CATCH_UP_ROWS] })
        await reader.return?.()
    })
})

describe("PostgresRealtimeHubService live delivery", () => {
    it("loads the row a notification names and hands it to every subscription of the topic on this replica, in order", async () => {
        const { hub, table, handlers } = await build()
        table.push(rowOf(1, "t:live", frameOf(1)), rowOf(2, "t:live", frameOf(2)))
        const first = hub.subscribe(topicOf("t:live"))[Symbol.asyncIterator]()
        const second = hub.subscribe(topicOf("t:live"))[Symbol.asyncIterator]()
        expect(hub.subscriberCount(topicOf("t:live"))).toBe(2)

        handlers.current.notify(notification("t:live", 1))
        handlers.current.notify(notification("t:live", 2))

        await expect(first.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await expect(first.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        await expect(second.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await first.return?.()
        await second.return?.()
    })

    it("reads nothing for a topic nobody on this replica follows", async () => {
        const { handlers, reads } = await build()
        reads.length = 0

        handlers.current.notify(notification("t:nobody", 9))
        await settle()

        expect(reads).toEqual([])
    })
})

describe("PostgresRealtimeHubService refused input", () => {
    it("ignores a notification that is not the shape the hub publishes", async () => {
        const { hub, logger, handlers } = await build()
        const reader = hub.subscribe(topicOf("t:bad"))[Symbol.asyncIterator]()

        handlers.current.notify("garbage")
        await settle()

        expect(logger.warn).toHaveBeenCalledWith(RealtimeLogEvent.NotificationIgnored)
        await reader.return?.()
    })

    it("reloads a failed live SELECT before the next notification can skip its frame", async () => {
        const { hub, answers, table, logger, handlers } = await build()
        table.push(rowOf(1, "t:fail", frameOf(1)), rowOf(2, "t:fail", frameOf(2)))
        const reader = hub.subscribe(topicOf("t:fail"))[Symbol.asyncIterator]()
        await settle()
        const loadRow = answers.get(SELECT_EVENT)
        let failed = false
        answers.set(SELECT_EVENT, (args) => {
            if (failed) return loadRow?.(args)
            failed = true
            return Promise.reject(new RealtimeError({ code: RealtimeErrorCode.ListenDropped }))
        })

        handlers.current.notify(notification("t:fail", 1))
        handlers.current.notify(notification("t:fail", 2))

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        await reader.return?.()
        await expect(reader.next()).resolves.toEqual({ done: true, value: undefined })
        expect(logger.error).toHaveBeenCalledWith(RealtimeLogEvent.DeliveryFailed, expect.any(Error))
        await reader.return?.()
    })
})
