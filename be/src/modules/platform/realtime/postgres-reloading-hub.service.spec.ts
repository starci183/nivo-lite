import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { REALTIME_TIMER } from "./realtime.decorators"
import type { Timer } from "@modules/platform/retry"
import { PostgresReloadingHubService } from "./postgres-reloading-hub.service"
import type { ListenHandlers, NotificationListener } from "./postgres-listener.port"
import { CATCH_UP_ROWS, REPLAY_FRAMES } from "./realtime.contracts"
import { REALTIME_LISTENER, REALTIME_MANAGERS } from "./realtime.decorators"
import { RealtimeLogEvent } from "./realtime.log-events"
import type { RealtimeTopic } from "./realtime.port"
import {
    SELECT_EVENT,
    SELECT_EVENTS_AFTER,
    SELECT_MISSED_EVENTS,
    SELECT_TOPIC_HIGHEST_SEQ,
} from "./persistence/realtime.sql"

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
            PostgresReloadingHubService,
            { provide: REALTIME_MANAGERS, useValue: [em] },
            { provide: REALTIME_LISTENER, useValue: listener },
            { provide: LOGGER, useValue: logger },
            { provide: REALTIME_TIMER, useValue: timer },
        ],
    }).compile()
    const hub = moduleRef.get(PostgresReloadingHubService)
    await hub.onModuleInit()
    return { hub, em, table, answers, listener, logger, handlers, transactions, scheduled }
}

const dropAndResume = async (handlers: CapturedHandlers): Promise<void> => {
    handlers.current.lost()
    handlers.current.resumed()
    await settle()
}
describe("PostgresReloadingHubService reload after a lost LISTEN connection", () => {
    it("reloads, for each followed topic, the frames after its own cursor", async () => {
        const { hub, em, table, handlers } = await build({ "t:down": 10 })
        const reader = hub.subscribe(topicOf("t:down"))[Symbol.asyncIterator]()
        await settle()
        table.push(rowOf(11, "t:down", frameOf(11)), rowOf(12, "t:down", frameOf(12)))

        await dropAndResume(handlers)

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(11) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(12) })
        expect(em.query).toHaveBeenCalledWith(SELECT_MISSED_EVENTS, [["t:down"], [10], CATCH_UP_ROWS])
        await reader.return?.()
    })

    it("keeps outage frames owed to S1 when S2 joins the same topic during the outage", async () => {
        const { hub, answers, table, handlers } = await build({ "t:shared": 5 })
        const first = hub.subscribe(topicOf("t:shared"))[Symbol.asyncIterator]()
        await settle()
        handlers.current.lost()
        table.push(rowOf(6, "t:shared", frameOf(6)), rowOf(7, "t:shared", frameOf(7)))
        answers.set(SELECT_TOPIC_HIGHEST_SEQ, () => [{ seq: "7" }])
        const second = hub.subscribe(topicOf("t:shared"))[Symbol.asyncIterator]()
        await settle()

        handlers.current.resumed()
        await settle()
        table.push(rowOf(8, "t:shared", frameOf(8)))
        handlers.current.notify(notification("t:shared", 8))

        await expect(first.next()).resolves.toEqual({ done: false, value: frameOf(6) })
        await expect(first.next()).resolves.toEqual({ done: false, value: frameOf(7) })
        await expect(first.next()).resolves.toEqual({ done: false, value: frameOf(8) })
        await expect(second.next()).resolves.toEqual({ done: false, value: frameOf(8) })
        await first.return?.()
        await second.return?.()
    })

    it("delivers queued notifications once to S1 when S2 joins before their held delivery resumes", async () => {
        const { hub, answers, table, handlers } = await build({ "t:queued": 5 })
        const first = hub.subscribe(topicOf("t:queued"))[Symbol.asyncIterator]()
        await settle()
        table.push(rowOf(6, "t:queued", frameOf(6)), rowOf(7, "t:queued", frameOf(7)))
        handlers.current.notify(notification("t:queued", 6))
        handlers.current.notify(notification("t:queued", 7))
        handlers.current.lost()
        answers.set(SELECT_TOPIC_HIGHEST_SEQ, () => [{ seq: "7" }])
        const second = hub.subscribe(topicOf("t:queued"))[Symbol.asyncIterator]()
        await settle()

        handlers.current.resumed()
        await settle()
        table.push(rowOf(8, "t:queued", frameOf(8)))
        handlers.current.notify(notification("t:queued", 8))

        await expect(first.next()).resolves.toEqual({ done: false, value: frameOf(6) })
        await expect(first.next()).resolves.toEqual({ done: false, value: frameOf(7) })
        await expect(first.next()).resolves.toEqual({ done: false, value: frameOf(8) })
        await expect(second.next()).resolves.toEqual({ done: false, value: frameOf(8) })
        await first.return?.()
        await second.return?.()
    })
})

describe("PostgresReloadingHubService reload after a lost LISTEN connection (part 2)", () => {
    it("uses the new receiver position when a topic is released and followed again during a full reload batch", async () => {
        const { hub, answers, table, handlers, em } = await build()
        const first = hub.subscribe(topicOf("t:refollow"))[Symbol.asyncIterator]()
        await settle()
        for (let seq = 1; seq <= CATCH_UP_ROWS; seq += 1) table.push(rowOf(seq, "t:refollow", frameOf(seq)))
        const gate = gateOf()
        const reloadAnswer = answers.get(SELECT_MISSED_EVENTS)
        answers.set(SELECT_MISSED_EVENTS, async (args) => {
            await gate.opened
            return reloadAnswer?.(args)
        })
        await dropAndResume(handlers)
        await first.return?.()
        answers.set(SELECT_TOPIC_HIGHEST_SEQ, () => [{ seq: String(CATCH_UP_ROWS) }])
        const second = hub.subscribe(topicOf("t:refollow"))[Symbol.asyncIterator]()
        await settle()
        table.push(rowOf(CATCH_UP_ROWS + 1, "t:refollow", frameOf(CATCH_UP_ROWS + 1)))

        gate.open()

        await expect(second.next()).resolves.toEqual({ done: false, value: frameOf(CATCH_UP_ROWS + 1) })
        expect(em.query).toHaveBeenCalledWith(SELECT_MISSED_EVENTS, [["t:refollow"], [CATCH_UP_ROWS], CATCH_UP_ROWS])
        await second.return?.()
    })

    it("loses no frame of a subscription still waiting for its first one, even when a lower sequence commits late", async () => {
        const { hub, table, handlers } = await build({ "t:quiet": 40, "t:busy": 45 })
        const quiet = hub.subscribe(topicOf("t:quiet"))[Symbol.asyncIterator]()
        const busy = hub.subscribe(topicOf("t:busy"))[Symbol.asyncIterator]()
        await settle()
        table.push(rowOf(51, "t:busy", frameOf(51)))
        handlers.current.notify(notification("t:busy", 51))
        await expect(busy.next()).resolves.toEqual({ done: false, value: frameOf(51) })

        handlers.current.lost()
        table.push(rowOf(50, "t:quiet", frameOf(50)))
        handlers.current.resumed()

        await expect(quiet.next()).resolves.toEqual({ done: false, value: frameOf(50) })
        await quiet.return?.()
        await busy.return?.()
    })

    it("stops reloading a topic that was released while a full batch was still being read", async () => {
        const { hub, em, table, answers, handlers } = await build({ "t:left": 0 })
        const reader = hub.subscribe(topicOf("t:left"))[Symbol.asyncIterator]()
        await settle()
        for (let seq = 1; seq <= CATCH_UP_ROWS; seq += 1) table.push(rowOf(seq, "t:left", frameOf(seq)))
        const gate = gateOf()
        const reloadAnswer = answers.get(SELECT_MISSED_EVENTS)
        answers.set(SELECT_MISSED_EVENTS, async (args) => {
            await gate.opened
            return reloadAnswer?.(args)
        })
        em.query.mockClear()

        await dropAndResume(handlers)
        await reader.return?.()
        gate.open()
        await settle()

        expect(em.query.mock.calls.filter(([sql]) => sql === SELECT_MISSED_EVENTS)).toHaveLength(1)
    })
})

describe("PostgresReloadingHubService reload after a lost LISTEN connection (part 3)", () => {
    it("advances full-batch pagination while a receiver is still waiting for its join snapshot", async () => {
        const { hub, answers, table, handlers, em } = await build()
        const gate = gateOf()
        answers.set(SELECT_TOPIC_HIGHEST_SEQ, async () => {
            await gate.opened
            return [{ seq: "0" }]
        })
        const reader = hub.subscribe(topicOf("t:loading"))[Symbol.asyncIterator]()
        for (let seq = 1; seq <= CATCH_UP_ROWS + 1; seq += 1) table.push(rowOf(seq, "t:loading", frameOf(seq)))

        await dropAndResume(handlers)

        expect(em.query.mock.calls.filter(([sql]) => sql === SELECT_MISSED_EVENTS)).toHaveLength(2)
        expect(em.query).toHaveBeenLastCalledWith(SELECT_MISSED_EVENTS, [["t:loading"], [CATCH_UP_ROWS], CATCH_UP_ROWS])
        gate.open()
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await reader.return?.()
    })

    it("keeps reloading while a batch comes back full", async () => {
        const { hub, em, table, handlers } = await build({ "t:many": 0 })
        const reader = hub.subscribe(topicOf("t:many"))[Symbol.asyncIterator]()
        await settle()
        for (let seq = 1; seq <= CATCH_UP_ROWS + 1; seq += 1) table.push(rowOf(seq, "t:many", frameOf(seq)))
        em.query.mockClear()

        await dropAndResume(handlers)

        expect(em.query).toHaveBeenCalledWith(SELECT_MISSED_EVENTS, [["t:many"], [CATCH_UP_ROWS], CATCH_UP_ROWS])
        await reader.return?.()
    })
})

describe("PostgresReloadingHubService held notifications during a reconnect", () => {
    it("holds a notification of the new connection until the reload finished, so the outage rows are neither skipped nor repeated", async () => {
        const { hub, table, handlers } = await build({ "t:held": 10 })
        const reader = hub.subscribe(topicOf("t:held"))[Symbol.asyncIterator]()
        await settle()
        table.push(rowOf(11, "t:held", frameOf(11)), rowOf(12, "t:held", frameOf(12)), rowOf(13, "t:held", frameOf(13)))

        handlers.current.lost()
        handlers.current.notify(notification("t:held", 13))
        handlers.current.resumed()
        table.push(rowOf(14, "t:held", frameOf(14)))
        handlers.current.notify(notification("t:held", 14))

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(11) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(12) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(13) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(14) })
        await reader.return?.()
    })

    it("delivers a held notification the reload did not see", async () => {
        const { hub, table, handlers } = await build({ "t:late": 10 })
        const reader = hub.subscribe(topicOf("t:late"))[Symbol.asyncIterator]()
        await settle()
        table.push(rowOf(11, "t:late", frameOf(11)))

        handlers.current.lost()
        handlers.current.notify(notification("t:late", 12))
        table.push(rowOf(12, "t:late", frameOf(12)))
        handlers.current.resumed()

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(11) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(12) })
        await reader.return?.()
    })

    it("takes the loss path again when loading a held notification fails", async () => {
        const { hub, answers, table, handlers, logger } = await build({ "t:held-fail": 10 })
        const reader = hub.subscribe(topicOf("t:held-fail"))[Symbol.asyncIterator]()
        await settle()
        const reloadAnswer = answers.get(SELECT_MISSED_EVENTS)
        let reloads = 0
        answers.set(SELECT_MISSED_EVENTS, (args) => {
            reloads += 1
            return reloads === 1 ? [] : reloadAnswer?.(args)
        })
        let loads = 0
        answers.set(SELECT_EVENT, ([seq]) => {
            loads += 1
            return loads === 1
                ? Promise.reject(new Error("stale writer"))
                : table.filter((row) => row.seq === String(seq))
        })
        table.push(rowOf(11, "t:held-fail", frameOf(11)), rowOf(12, "t:held-fail", frameOf(12)))
        handlers.current.lost()
        handlers.current.notify(notification("t:held-fail", 11))
        handlers.current.notify(notification("t:held-fail", 12))
        handlers.current.resumed()

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(11) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(12) })
        expect(logger.error).toHaveBeenCalledWith(RealtimeLogEvent.DeliveryFailed, expect.any(Error))
        await reader.return?.()
        await expect(reader.next()).resolves.toEqual({ done: true, value: undefined })
    })
})

describe("PostgresReloadingHubService held notifications during a reconnect (part 2)", () => {
    it("keeps the notifications of the newer connection held when a second loss overtakes a reload", async () => {
        const { hub, em, table, answers, handlers } = await build({ "t:flap": 10 })
        const reader = hub.subscribe(topicOf("t:flap"))[Symbol.asyncIterator]()
        await settle()
        table.push(rowOf(11, "t:flap", frameOf(11)))
        const gate = gateOf()
        const reloadAnswer = answers.get(SELECT_MISSED_EVENTS)
        answers.set(SELECT_MISSED_EVENTS, async (args) => {
            await gate.opened
            return reloadAnswer?.(args)
        })

        await dropAndResume(handlers)
        handlers.current.lost()
        handlers.current.notify(notification("t:flap", 12))
        gate.open()
        await settle()
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(11) })
        expect(em.query).not.toHaveBeenCalledWith(SELECT_EVENT, [12])

        table.push(rowOf(12, "t:flap", frameOf(12)))
        handlers.current.resumed()

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(12) })
        await reader.return?.()
    })
})

describe("PostgresReloadingHubService replay", () => {
    it("starts with the frames after the last event id, then goes live", async () => {
        const { hub, em, answers, table, handlers } = await build()
        answers.set(SELECT_EVENTS_AFTER, () => [rowOf(5, "t:replay", frameOf(5)), rowOf(6, "t:replay", frameOf(6))])
        table.push(rowOf(7, "t:replay", frameOf(7)))
        const reader = hub.subscribe(topicOf("t:replay"), { after: "e-4" })[Symbol.asyncIterator]()

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(5) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(6) })
        handlers.current.notify(notification("t:replay", 7))

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(7) })
        expect(em.query).toHaveBeenCalledWith(SELECT_EVENTS_AFTER, ["t:replay", "e-4", REPLAY_FRAMES])
        await reader.return?.()
    })

    it("holds the live frames that arrive while the replay loads and drops the ones the replay already holds", async () => {
        const { hub, answers, table, handlers } = await build()
        const gate = gateOf()
        answers.set(SELECT_EVENTS_AFTER, async () => {
            await gate.opened
            return [rowOf(5, "t:race", frameOf(5)), rowOf(6, "t:race", frameOf(6))]
        })
        table.push(rowOf(6, "t:race", frameOf(6)), rowOf(7, "t:race", frameOf(7)))
        const reader = hub.subscribe(topicOf("t:race"), { after: "e-4" })[Symbol.asyncIterator]()
        const first = reader.next()

        handlers.current.notify(notification("t:race", 6))
        handlers.current.notify(notification("t:race", 7))
        await settle()
        gate.open()

        await expect(first).resolves.toEqual({ done: false, value: frameOf(5) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(6) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(7) })
        await reader.return?.()
    })
})
