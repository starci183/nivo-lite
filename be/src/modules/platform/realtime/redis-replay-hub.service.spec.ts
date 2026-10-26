import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { REPLAY_FRAMES, REPLAY_TTL_MS, RETAIN_AND_PUBLISH_SCRIPT } from "./realtime.contracts"
import { REALTIME_REDIS_OPTIONS, REALTIME_REDIS_PUBLISHER } from "./realtime.decorators"
import type { RealtimeTopic } from "./realtime.port"
import type { RedisConnection, RedisStreamReply } from "./redis-realtime.port"
import { RedisReplayHubService } from "./redis-replay-hub.service"
import { compareStreamIds } from "./redis-stream-id.policy"

interface Frame {
    readonly id: string
    readonly value: number
}

const isFrame = (value: unknown): value is Frame =>
    typeof value === "object" && value !== null && "id" in value && "value" in value

const topicOf = (name: string): RealtimeTopic<Frame> => ({ name, accepts: isFrame })

const frameOf = (value: number): Frame => ({ id: `e-${value}`, value })

/** The wire form of a retained entry: `[stream id, [field, value, ...]]`. */
const entryOf = (position: string, frame: Frame): [string, Array<string>] => [
    position,
    ["id", frame.id, "data", JSON.stringify(frame)],
]

const OPTIONS = { hub: "redis", url: new Secret("redis://redis:6379"), db: 0, prefix: "app" } as const

/** The hub over a scripted Redis connection that keeps the streams the retain script writes. */
const build = async () => {
    const streams = new Map<string, Array<[string, Array<string>]>>()
    const publisher = mock<RedisConnection>()
    publisher.eval.mockImplementation((_script, _keys, ...args) => {
        const [key, , id, json] = args.map(String)
        const entries = streams.get(key ?? "") ?? []
        const position = `${entries.length + 1}-0`
        entries.push([position, ["id", id ?? "", "data", json ?? ""]])
        streams.set(key ?? "", entries)
        return Promise.resolve(position)
    })
    publisher.xrange.mockImplementation((key, start): Promise<RedisStreamReply> => {
        const entries = streams.get(key) ?? []
        return Promise.resolve(
            start.startsWith("(")
                ? entries.filter(([position]) => compareStreamIds(position, start.slice(1)) > 0)
                : [...entries],
        )
    })
    publisher.publish.mockResolvedValue(1)
    const moduleRef = await Test.createTestingModule({
        providers: [
            RedisReplayHubService,
            { provide: REALTIME_REDIS_PUBLISHER, useValue: publisher },
            { provide: REALTIME_REDIS_OPTIONS, useValue: OPTIONS },
        ],
    }).compile()
    return { hub: moduleRef.get(RedisReplayHubService), publisher, streams }
}

describe("RedisReplayHubService retention", () => {
    it("keeps a frame that carries an id in the stream of its topic, bounded in length and in time, in one atomic script", async () => {
        const { hub, publisher, streams } = await build()

        await hub.publish(topicOf("t:keep"), frameOf(1))

        expect(streams.get("app:t:keep")).toEqual([entryOf("1-0", frameOf(1))])
        expect(publisher.eval).toHaveBeenCalledTimes(1)
        expect(publisher.eval).toHaveBeenCalledWith(
            RETAIN_AND_PUBLISH_SCRIPT,
            1,
            "app:t:keep",
            REPLAY_FRAMES,
            "e-1",
            JSON.stringify(frameOf(1)),
            REPLAY_TTL_MS,
            "app",
            "t:keep",
        )
    })
})

describe("RedisReplayHubService replay", () => {
    it("starts with the frames after the last event id, and nothing older", async () => {
        const { hub, streams } = await build()
        const topic = topicOf("t:replay")
        await hub.publish(topic, frameOf(1))
        await hub.publish(topic, frameOf(2))
        await hub.publish(topic, frameOf(3))

        const reader = hub.subscribe(topic, { after: "e-1" })[Symbol.asyncIterator]()
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(3) })
        expect(streams.get("app:t:replay")).toHaveLength(3)
        await reader.return?.()
    })

    it("replays the retained frames for an id it no longer holds", async () => {
        const { hub } = await build()
        const topic = topicOf("t:gone")
        await hub.publish(topic, frameOf(1))
        await hub.publish(topic, frameOf(2))

        const reader = hub.subscribe(topic, { after: "e-none" })[Symbol.asyncIterator]()

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        await reader.return?.()
    })

    it("resumes after the newest frame carrying the id, the same as the Postgres hub", async () => {
        const { hub, streams } = await build()
        const topic = topicOf("t:twice")
        streams.set("app:t:twice", [
            entryOf("1-0", frameOf(1)),
            entryOf("2-0", { id: "e-1", value: 9 }),
            entryOf("3-0", frameOf(3)),
        ])

        const reader = hub.subscribe(topic, { after: "e-1" })[Symbol.asyncIterator]()

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(3) })
        await reader.return?.()
    })
})
