import { Test } from "@nestjs/testing"
import { RealtimeSubscriptionsPolicy } from "./realtime-subscriptions.policy"
import type { Entry, Replay } from "./realtime-subscriptions.policy"
import type { RealtimeTopic } from "./realtime.port"

interface Frame {
    readonly value: number
}

const isFrame = (value: unknown): value is Frame => typeof value === "object" && value !== null && "value" in value

const topicOf = (name: string): RealtimeTopic<Frame> => ({ name, accepts: isFrame })

const entryOf = (topic: string, value: number): Entry => ({ topic, frame: { value }, position: `p-${value}` })

const settle = () => new Promise<void>((resolve) => setImmediate(resolve))

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [RealtimeSubscriptionsPolicy] }).compile()
    return moduleRef.get(RealtimeSubscriptionsPolicy)
}
const numericEntry = (position: number, frame: object = { value: position }): Entry => ({
    topic: "t:ordered",
    position: String(position),
    frame,
})

const compareNumbers = (left: string, right: string): number => Number(left) - Number(right)

describe("RealtimeSubscriptionsPolicy membership", () => {
    it("counts and lists the subscriptions that follow a topic, and forgets a topic nobody follows", async () => {
        const subscriptions = await build()
        const first = subscriptions.join(topicOf("t:a"), Promise.resolve({ entries: [] }))
        const second = subscriptions.join(topicOf("t:a"), Promise.resolve({ entries: [] }))

        expect(subscriptions.count("t:a")).toBe(2)
        expect(subscriptions.follows("t:a")).toBe(true)
        expect(subscriptions.topics()).toEqual(["t:a"])
        expect(subscriptions.floorOf("t:a")).toBeUndefined()
        await first.return?.()
        expect(subscriptions.count("t:a")).toBe(1)
        await second.return?.()

        expect(subscriptions.count("t:a")).toBe(0)
        expect(subscriptions.follows("t:a")).toBe(false)
        expect(subscriptions.topics()).toEqual([])
    })
})

describe("RealtimeSubscriptionsPolicy delivery", () => {
    it("hands each entry to the subscriptions of its own topic only, in order, and only frames the topic accepts", async () => {
        const subscriptions = await build()
        const mine = subscriptions.join(topicOf("t:mine"), Promise.resolve({ entries: [] }))
        const other = subscriptions.join(topicOf("t:other"), Promise.resolve({ entries: [] }))
        await settle()

        subscriptions.fanOut([
            entryOf("t:mine", 1),
            { topic: "t:mine", frame: { nope: true }, position: "x" },
            entryOf("t:mine", 2),
        ])
        subscriptions.fanOut([entryOf("t:nobody", 9)])

        await expect(mine.next()).resolves.toEqual({ done: false, value: { value: 1 } })
        await expect(mine.next()).resolves.toEqual({ done: false, value: { value: 2 } })
        expect(subscriptions.count("t:other")).toBe(1)
        await mine.return?.()
        await other.return?.()
    })

    it("wakes a reader that is waiting when the frame arrives, and ends it when it stops", async () => {
        const subscriptions = await build()
        const reader = subscriptions.join(topicOf("t:wait"), Promise.resolve({ entries: [] }))
        const waiting = reader.next()
        await settle()

        subscriptions.fanOut([entryOf("t:wait", 1)])
        await expect(waiting).resolves.toEqual({ done: false, value: { value: 1 } })
        const ending = reader.next()
        await settle()
        await reader.return?.()

        await expect(ending).resolves.toEqual({ done: true, value: undefined })
        await expect(reader.next()).resolves.toEqual({ done: true, value: undefined })
    })

    it("releasing a reader that is not waiting leaves nothing to wake", async () => {
        const subscriptions = await build()
        const reader = subscriptions.join(topicOf("t:idle"), Promise.resolve({ entries: [] }))

        await expect(reader.return?.()).resolves.toEqual({ done: true, value: undefined })
    })
})

describe("RealtimeSubscriptionsPolicy close", () => {
    it("ends every open subscription, waking the readers that wait for a frame", async () => {
        const subscriptions = await build()
        const first = subscriptions.join(topicOf("t:a"), Promise.resolve({ entries: [] }))
        const second = subscriptions.join(topicOf("t:b"), Promise.resolve({ entries: [] }))
        await settle()
        const waiting = first.next()
        await settle()

        subscriptions.close()

        await expect(waiting).resolves.toEqual({ done: true, value: undefined })
        await expect(first.next()).resolves.toEqual({ done: true, value: undefined })
        await expect(second.next()).resolves.toEqual({ done: true, value: undefined })
        expect(subscriptions.topics()).toEqual([])
    })

    it("a close with no open subscription does nothing", async () => {
        const subscriptions = await build()

        subscriptions.close()

        expect(subscriptions.topics()).toEqual([])
    })
})

describe("RealtimeSubscriptionsPolicy replay", () => {
    it("starts with the replay, then goes live", async () => {
        const subscriptions = await build()
        const reader = subscriptions.join(
            topicOf("t:replay"),
            Promise.resolve({ entries: [entryOf("t:replay", 1), entryOf("t:replay", 2)] }),
        )

        await expect(reader.next()).resolves.toEqual({ done: false, value: { value: 1 } })
        await expect(reader.next()).resolves.toEqual({ done: false, value: { value: 2 } })
        subscriptions.fanOut([entryOf("t:replay", 3)])

        await expect(reader.next()).resolves.toEqual({ done: false, value: { value: 3 } })
        await reader.return?.()
    })

    it("holds the live entries that arrive while the replay loads and drops the ones the replay already holds", async () => {
        const subscriptions = await build()
        let release: (replay: Replay) => void = () => undefined
        const reader = subscriptions.join(
            topicOf("t:race"),
            new Promise((resolve) => {
                release = resolve
            }),
        )
        const first = reader.next()

        subscriptions.fanOut([entryOf("t:race", 2), entryOf("t:race", 3)])
        release({ entries: [entryOf("t:race", 1), entryOf("t:race", 2)] })

        await expect(first).resolves.toEqual({ done: false, value: { value: 1 } })
        await expect(reader.next()).resolves.toEqual({ done: false, value: { value: 2 } })
        await expect(reader.next()).resolves.toEqual({ done: false, value: { value: 3 } })
        await reader.return?.()
    })

    it("fails the read of a stream whose replay could not be loaded, with the cause the store gave", async () => {
        const subscriptions = await build()
        const reader = subscriptions.join(topicOf("t:broken"), Promise.reject(new Error("db down")))

        await expect(reader.next()).rejects.toMatchObject({
            code: "REALTIME_REPLAY_FAILED",
            cause: new Error("db down"),
        })
        expect(subscriptions.count("t:broken")).toBe(0)
        expect(subscriptions.topics()).toEqual([])
        const replacement = subscriptions.join(topicOf("t:broken"), Promise.resolve({ entries: [] }))
        await reader.return?.()
        expect(subscriptions.count("t:broken")).toBe(1)
        await replacement.return?.()
    })
})

describe("RealtimeSubscriptionsPolicy ordered positions", () => {
    it("reloads from the oldest receiver, including one still loading, without moving an older receiver on a new join", async () => {
        const subscriptions = new RealtimeSubscriptionsPolicy(compareNumbers, "0")
        expect(subscriptions.floorOf("t:ordered")).toBeUndefined()
        const older = subscriptions.join(topicOf("t:ordered"), Promise.resolve({ entries: [], position: "5" }))
        expect(subscriptions.floorOf("t:ordered")).toBe("0")
        await settle()
        const newer = subscriptions.join(topicOf("t:ordered"), Promise.resolve({ entries: [], position: "7" }))
        await settle()
        expect(subscriptions.floorOf("t:ordered")).toBe("5")

        subscriptions.fanOut([numericEntry(6), numericEntry(7), numericEntry(7)])
        await expect(older.next()).resolves.toEqual({ done: false, value: { value: 6 } })
        await expect(older.next()).resolves.toEqual({ done: false, value: { value: 7 } })
        subscriptions.fanOut([numericEntry(8)])
        await expect(older.next()).resolves.toEqual({ done: false, value: { value: 8 } })
        await expect(newer.next()).resolves.toEqual({ done: false, value: { value: 8 } })
        expect(subscriptions.floorOf("t:ordered")).toBe("8")
        await older.return?.()
        await newer.return?.()
        expect(subscriptions.floorOf("t:ordered")).toBeUndefined()
    })

    it("takes an explicit replay before its snapshot and suppresses late live copies after the replay is ready", async () => {
        const subscriptions = new RealtimeSubscriptionsPolicy(compareNumbers, "0")
        const reader = subscriptions.join(
            topicOf("t:ordered"),
            Promise.resolve({ entries: [numericEntry(4), numericEntry(5)], position: "5" }),
        )
        await settle()
        subscriptions.fanOut([numericEntry(4), numericEntry(5), numericEntry(6)])

        await expect(reader.next()).resolves.toEqual({ done: false, value: { value: 4 } })
        await expect(reader.next()).resolves.toEqual({ done: false, value: { value: 5 } })
        await expect(reader.next()).resolves.toEqual({ done: false, value: { value: 6 } })
        await reader.return?.()
    })

    it("keeps a replay position newer than its snapshot, advances over rejected frames and passes unpositioned frames live", async () => {
        const subscriptions = new RealtimeSubscriptionsPolicy(compareNumbers, "0")
        const reader = subscriptions.join(
            topicOf("t:ordered"),
            Promise.resolve({ entries: [numericEntry(6)], position: "5" }),
        )
        await expect(reader.next()).resolves.toEqual({ done: false, value: { value: 6 } })
        subscriptions.fanOut([numericEntry(7, { nope: true })])
        expect(subscriptions.floorOf("t:ordered")).toBe("7")
        subscriptions.fanOut([{ topic: "t:ordered", position: "", frame: { value: 8 } }])
        await expect(reader.next()).resolves.toEqual({ done: false, value: { value: 8 } })
        expect(subscriptions.floorOf("t:ordered")).toBe("7")
        await reader.return?.()
    })

    it("chooses a later receiver's lower floor and removes it on release", async () => {
        const subscriptions = new RealtimeSubscriptionsPolicy(compareNumbers, "0")
        const first = subscriptions.join(topicOf("t:ordered"), Promise.resolve({ entries: [], position: "9" }))
        const second = subscriptions.join(topicOf("t:ordered"), Promise.resolve({ entries: [], position: "5" }))
        await settle()

        expect(subscriptions.floorOf("t:ordered")).toBe("5")
        await second.return?.()
        expect(subscriptions.floorOf("t:ordered")).toBe("9")
        await first.return?.()
    })

    it("leaves an unknown floor unresolved until its replay supplies a position", async () => {
        const subscriptions = new RealtimeSubscriptionsPolicy(compareNumbers)
        const reader = subscriptions.join(topicOf("t:ordered"), Promise.resolve({ entries: [], position: "5" }))
        expect(subscriptions.floorOf("t:ordered")).toBeUndefined()
        await settle()
        expect(subscriptions.floorOf("t:ordered")).toBe("5")
        await reader.return?.()
    })
})

describe("RealtimeSubscriptionsPolicy ordered positions (part 2)", () => {
    it("can establish its first ordered position from an entry when replay has no snapshot", async () => {
        const subscriptions = new RealtimeSubscriptionsPolicy(compareNumbers)
        const reader = subscriptions.join(topicOf("t:ordered"), Promise.resolve({ entries: [numericEntry(2)] }))

        await expect(reader.next()).resolves.toEqual({ done: false, value: { value: 2 } })
        expect(subscriptions.floorOf("t:ordered")).toBe("2")
        await reader.return?.()
    })
})
