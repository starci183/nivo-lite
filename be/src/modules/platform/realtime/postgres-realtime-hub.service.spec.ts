import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { REALTIME_TIMER } from "./realtime.decorators"
import type { Timer } from "@modules/platform/retry"
import { RealtimeError, RealtimeErrorCode } from "./errors/realtime.error"
import { PostgresRealtimeHubService } from "./postgres-realtime-hub.service"
import type { ListenHandlers, NotificationListener } from "./postgres-listener.port"
import { CATCH_UP_ROWS, NOTIFY_CHANNEL, RECONNECT_DELAY_MS } from "./realtime.contracts"
import { REALTIME_LISTENER, REALTIME_MANAGERS } from "./realtime.decorators"
import { RealtimeLogEvent } from "./realtime.log-events"
import type { RealtimeTopic } from "./realtime.port"
import {
    SELECT_EVENT,
    SELECT_MISSED_EVENTS,
    SELECT_TOPIC_HIGHEST_SEQ,
    scriptRealtimeReads,
} from "@tests/fixtures/builders/realtime-statements.builder"

interface Frame {
    readonly id: string
    readonly value: number
}

const isFrame = (value: unknown): value is Frame =>
    typeof value === "object" && value !== null && "id" in value && "value" in value

const topicOf = (name: string): RealtimeTopic<Frame> => ({ name, accepts: isFrame })

const frameOf = (value: number): Frame => ({ id: `e-${value}`, value })

const rowOf = (seq: number, topic: string, payload: object) => ({ seq: String(seq), topic, payload })

const notification = (topic: string, seq: number): string => JSON.stringify({ topic, seq })

const settle = () => new Promise<void>((resolve) => setImmediate(resolve))

type Answer = (args: ReadonlyArray<unknown>) => unknown

type Row = ReturnType<typeof rowOf>

const strings = (value: unknown): ReadonlyArray<string> =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

const numbers = (value: unknown): ReadonlyArray<number> =>
    Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : []

const gateOf = () => {
    let open: () => void = () => undefined
    const opened = new Promise<void>((resolve) => {
        open = resolve
    })
    return { open, opened }
}

interface CapturedHandlers {
    current: ListenHandlers
}

/**
 * The hub on a scripted database. `table` holds the committed rows; the statements the hub runs answer from it: the highest sequence of
 * a topic, the row a notification names, and the rows after each topic's cursor. A statement the spec did not script answers no rows.
 */
const build = async (watermarks: Readonly<Record<string, number>> = {}) => {
    const em: MockEntityManager = mockEntityManager()
    const table: Array<Row> = []
    const answers = new Map<string, Answer>([
        [SELECT_TOPIC_HIGHEST_SEQ, ([topic]) => [{ seq: String(watermarks[String(topic)] ?? 0) }]],
        [SELECT_EVENT, ([seq]) => table.filter((row) => row.seq === String(seq))],
        [
            SELECT_MISSED_EVENTS,
            ([topics, cursors, limit]) => {
                const names = strings(topics)
                const after = numbers(cursors)
                return table
                    .filter((row) => Number(row.seq) > (after[names.indexOf(row.topic)] ?? Infinity))
                    .sort((left, right) => Number(left.seq) - Number(right.seq))
                    .slice(0, Number(limit))
            },
        ],
    ])
    em.query.mockImplementation((sql: string, args: Array<unknown> = []) =>
        Promise.resolve(answers.get(sql)?.(args) ?? []),
    )
    scriptRealtimeReads(em)
    const transactions = fakeTransaction(em)
    const handlers: CapturedHandlers = {
        current: {
            notify: () => undefined,
            probe: () => Promise.resolve(),
            lost: () => undefined,
            resumed: () => undefined,
        },
    }
    const listener = mock<NotificationListener>()
    listener.start.mockImplementation((given) => {
        handlers.current = given
        return Promise.resolve()
    })
    const scheduled: Array<{ readonly callback: () => void; readonly delayMs: number; cancelled: boolean }> = []
    const timer = mock<Timer>()
    timer.schedule.mockImplementation((callback, delayMs) => {
        const entry = { callback, delayMs, cancelled: false }
        scheduled.push(entry)
        return () => {
            entry.cancelled = true
        }
    })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PostgresRealtimeHubService,
            { provide: REALTIME_MANAGERS, useValue: [em] },
            { provide: REALTIME_LISTENER, useValue: listener },
            { provide: LOGGER, useValue: logger },
            { provide: REALTIME_TIMER, useValue: timer },
        ],
    }).compile()
    const hub = moduleRef.get(PostgresRealtimeHubService)
    await hub.onModuleInit()
    return { hub, em, table, answers, listener, logger, handlers, transactions, scheduled }
}

const dropAndResume = async (handlers: CapturedHandlers): Promise<void> => {
    handlers.current.lost()
    handlers.current.resumed()
    await settle()
}
describe("PostgresRealtimeHubService start and stop", () => {
    it("sends the probe of a new connection from its own session, so it proves delivery across sessions", async () => {
        const { em, handlers } = await build()

        await handlers.current.probe("probe:abc")

        expect(em.query).toHaveBeenCalledWith("SELECT pg_notify($1, $2)", [NOTIFY_CHANNEL, "probe:abc"])
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
        const { hub, em, table, answers, handlers } = await build()
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
        expect(em.query).toHaveBeenCalledWith(SELECT_EVENT, ["1"])
    })
})

describe("PostgresRealtimeHubService reload bookkeeping", () => {
    it("keeps notifications held after a failed reload, retries with the Timer, then delivers outage frames once", async () => {
        const { hub, answers, em, table, logger, handlers, scheduled } = await build({ "t:fail": 10 })
        const reader = hub.subscribe(topicOf("t:fail"))[Symbol.asyncIterator]()
        await settle()
        const reloadAnswer = answers.get(SELECT_MISSED_EVENTS)
        answers.set(SELECT_MISSED_EVENTS, () => Promise.reject(new Error("db down")))
        table.push(rowOf(11, "t:fail", frameOf(11)), rowOf(12, "t:fail", frameOf(12)))

        handlers.current.lost()
        handlers.current.notify(notification("t:fail", 12))
        handlers.current.resumed()
        await settle()

        expect(em.query).not.toHaveBeenCalledWith(SELECT_EVENT, ["12"])
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
        const { hub, answers, em, handlers, scheduled } = await build()
        hub.subscribe(topicOf("t:stop"))[Symbol.asyncIterator]()
        await settle()
        answers.set(SELECT_MISSED_EVENTS, () => Promise.reject(new Error("db down")))
        await dropAndResume(handlers)

        await hub.onModuleDestroy()
        em.query.mockClear()
        scheduled[0]?.callback()
        await settle()

        expect(scheduled[0]?.cancelled).toBe(true)
        expect(em.query).not.toHaveBeenCalled()
    })

    it("does not let a stale retry release notifications belonging to a newer loss", async () => {
        const { hub, answers, em, table, handlers, scheduled } = await build()
        const reader = hub.subscribe(topicOf("t:retry-flap"))[Symbol.asyncIterator]()
        await settle()
        const reloadAnswer = answers.get(SELECT_MISSED_EVENTS)
        answers.set(SELECT_MISSED_EVENTS, () => Promise.reject(new Error("db down")))
        await dropAndResume(handlers)
        handlers.current.lost()
        handlers.current.notify(notification("t:retry-flap", 1))
        answers.set(SELECT_MISSED_EVENTS, (args) => reloadAnswer?.(args))
        em.query.mockClear()

        scheduled[0]?.callback()
        await settle()

        expect(em.query).not.toHaveBeenCalled()
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
        const { hub, answers, handlers, scheduled, em } = await build()
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

        expect(em.query).not.toHaveBeenCalledWith(SELECT_EVENT, ["1"])
        expect(scheduled).toHaveLength(0)
    })
})

describe("PostgresRealtimeHubService reload bookkeeping (part 3)", () => {
    it("forgets the cursor of a topic nobody follows any more, so a new subscription starts from where the topic stands", async () => {
        const { hub, em, table, handlers } = await build({ "t:gone": 0 })
        const gone = hub.subscribe(topicOf("t:gone"))[Symbol.asyncIterator]()
        await settle()
        table.push(rowOf(5, "t:gone", frameOf(5)))
        handlers.current.notify(notification("t:gone", 5))
        await expect(gone.next()).resolves.toEqual({ done: false, value: frameOf(5) })
        await gone.return?.()
        em.query.mockImplementation((sql: string) =>
            Promise.resolve(sql === SELECT_TOPIC_HIGHEST_SEQ ? [{ seq: "7" }] : []),
        )
        const again = hub.subscribe(topicOf("t:gone"))[Symbol.asyncIterator]()
        await settle()

        await dropAndResume(handlers)

        expect(em.query).toHaveBeenLastCalledWith(SELECT_MISSED_EVENTS, [["t:gone"], [7], CATCH_UP_ROWS])
        await again.return?.()
    })

    it("starts from zero when the table answers nothing for a new topic", async () => {
        const { hub, em, answers, handlers } = await build()
        answers.set(SELECT_TOPIC_HIGHEST_SEQ, () => [])
        const reader = hub.subscribe(topicOf("t:new"))[Symbol.asyncIterator]()
        await settle()

        await dropAndResume(handlers)

        expect(em.query).toHaveBeenLastCalledWith(SELECT_MISSED_EVENTS, [["t:new"], [0], CATCH_UP_ROWS])
        await reader.return?.()
    })

    it("reloads from zero while a subscription is still reading its starting point", async () => {
        const { hub, em, answers, handlers } = await build()
        const gate = gateOf()
        answers.set(SELECT_TOPIC_HIGHEST_SEQ, async () => {
            await gate.opened
            return [{ seq: "3" }]
        })
        const reader = hub.subscribe(topicOf("t:pending"))[Symbol.asyncIterator]()
        em.query.mockClear()

        await dropAndResume(handlers)
        gate.open()
        await settle()

        expect(em.query).toHaveBeenCalledWith(SELECT_MISSED_EVENTS, [["t:pending"], [0], CATCH_UP_ROWS])
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
        const { em, handlers } = await build()
        em.query.mockClear()

        handlers.current.notify(notification("t:nobody", 9))
        await settle()

        expect(em.query).not.toHaveBeenCalled()
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
        const { hub, em, table, logger, handlers } = await build()
        table.push(rowOf(1, "t:fail", frameOf(1)), rowOf(2, "t:fail", frameOf(2)))
        const reader = hub.subscribe(topicOf("t:fail"))[Symbol.asyncIterator]()
        await settle()
        em.query.mockImplementationOnce((sql: string) =>
            sql === SELECT_EVENT ? Promise.reject(new Error("db down")) : Promise.resolve([]),
        )

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
