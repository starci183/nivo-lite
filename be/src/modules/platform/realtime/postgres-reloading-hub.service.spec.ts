import { RealtimeEventEntity } from "./persistence/entities"
import { CATCH_UP_ROWS, REPLAY_FRAMES } from "./realtime.contracts"
import { RealtimeLogEvent } from "./realtime.log-events"
import {
    SELECT_EVENT,
    SELECT_EVENTS_AFTER,
    SELECT_MISSED_EVENTS,
    SELECT_TOPIC_HIGHEST_SEQ,
} from "@tests/fixtures/builders/realtime-statements.builder"
import {
    build,
    buildReads,
    dropAndResume,
    frameOf,
    gateOf,
    notification,
    rowOf,
    settle,
    topicOf,
} from "@tests/fixtures/builders/realtime-reloading-hub.builder"

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
        expect(em.query).not.toHaveBeenCalledWith(SELECT_EVENT, ["12"])

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

describe("PostgresReloadingHubService reads", () => {
    it("loads the row a notification names, and nothing when the sweep already deleted it", async () => {
        const { hub, em } = await buildReads()
        const delivered: Array<unknown> = []
        const subscriptions = (
            hub as unknown as { subscriptions: { follows: () => boolean; fanOut: (entries: Array<unknown>) => void } }
        ).subscriptions
        subscriptions.follows = () => true
        subscriptions.fanOut = (entries) => delivered.push(...entries)
        em.findOne.mockResolvedValueOnce(
            Object.assign(new RealtimeEventEntity(), { seq: "3", topic: "t:one", payload: { id: "e-3" } }) as never,
        )
        em.findOne.mockResolvedValueOnce(null as never)
        const deliver = (payload: string) =>
            (hub as unknown as { deliverNow: (payload: string) => Promise<void> }).deliverNow(payload)

        await deliver(JSON.stringify({ topic: "t:one", seq: 3 }))
        await deliver(JSON.stringify({ topic: "t:one", seq: 4 }))

        expect(em.findOne).toHaveBeenNthCalledWith(1, RealtimeEventEntity, {
            select: { seq: true, topic: true, payload: true },
            where: { seq: "3" },
        })
        expect(delivered).toEqual([{ position: "3", topic: "t:one", frame: { id: "e-3" } }])
    })

    it("reloads what the followed topics missed after each topic's own cursor, oldest first and bounded", async () => {
        const { hub, fakes } = await buildReads({ getRawMany: [] })
        const subscriptions = (
            hub as unknown as {
                subscriptions: { follows: () => boolean; floorOf: (topic: string) => string; fanOut: () => void }
            }
        ).subscriptions
        subscriptions.follows = () => true
        subscriptions.floorOf = (topic) => (topic === "t:a" ? "10" : "0")
        subscriptions.fanOut = () => undefined

        await (
            hub as unknown as { reloadFrom: (topics: Array<string>, loaded: Map<string, number>) => Promise<void> }
        ).reloadFrom(["t:a", "t:b"], new Map([["t:b", 4]]))

        const [read] = fakes
        expect(read?.callsOf("innerJoin")[0]?.[1]).toBe("cursors")
        expect(read?.callsOf("innerJoin")[0]?.[2]).toBe("e.topic = cursors.topic AND e.seq > cursors.after")
        expect(read?.callsOf("setParameters")).toEqual([[{ topics: ["t:a", "t:b"], cursors: [10, 4] }]])
        expect(read?.callsOf("orderBy")).toEqual([["e.seq", "ASC"]])
        expect(read?.callsOf("limit")).toEqual([[CATCH_UP_ROWS]])
    })
})
