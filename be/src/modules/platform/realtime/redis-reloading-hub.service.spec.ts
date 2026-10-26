import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { REALTIME_TIMER } from "./realtime.decorators"
import type { Timer } from "@modules/platform/retry"
import { REALTIME_REDIS_OPTIONS, REALTIME_REDIS_PUBLISHER, REALTIME_REDIS_SUBSCRIBER } from "./realtime.decorators"
import { RealtimeLogEvent } from "./realtime.log-events"
import type { RealtimeTopic } from "./realtime.port"
import type { RedisConnection, RedisStreamReply } from "./redis-realtime.port"
import { RedisReloadingHubService } from "./redis-reloading-hub.service"
import { compareStreamIds } from "./redis-stream-id.policy"

interface Frame {
    readonly id: string
    readonly value: number
}

const isFrame = (value: unknown): value is Frame =>
    typeof value === "object" && value !== null && "id" in value && "value" in value

const topicOf = (name: string): RealtimeTopic<Frame> => ({ name, accepts: isFrame })

const frameOf = (value: number): Frame => ({ id: `e-${value}`, value })

const settle = () => new Promise<void>((resolve) => setImmediate(resolve))

/** The wire form of a retained entry: `[stream id, [field, value, ...]]`. */
const entryOf = (position: string, frame: Frame): [string, Array<string>] => [
    position,
    ["id", frame.id, "data", JSON.stringify(frame)],
]

/** The message the script publishes on the channel for a retained frame. */
const messageOf = (topic: string, position: string, frame: Frame): string =>
    JSON.stringify({ topic, position, frame: JSON.stringify(frame) })

const OPTIONS = { hub: "redis", url: new Secret("redis://redis:6379"), db: 0, prefix: "app" } as const

/** A stream read that waits until the spec lets it answer. */
interface Gate {
    release: () => void
    readonly opened: Promise<void>
}

const gateOf = (): Gate => {
    let release: () => void = () => undefined
    const opened = new Promise<void>((resolve) => {
        release = resolve
    })
    return { release, opened }
}

/**
 * The hub over two scripted Redis connections. The publisher keeps the streams the hub writes: the retain script appends the entry and
 * hands the message to the subscriber listeners, as Redis does for a subscribed connection. The spec can add entries to a stream without
 * delivering them (what was published while the subscriber was disconnected) and emit the subscriber events itself.
 */
const build = async (options: { readonly readyDuringBoot?: boolean } = {}) => {
    const streams = new Map<string, Array<[string, Array<string>]>>()
    const publisher = mock<RedisConnection>()
    const subscriber = mock<RedisConnection>()
    const registered = new Map<RedisConnection, Map<string, Array<(...args: Array<never>) => void>>>()
    const register = (connection: RedisConnection) => (event: string, listener: (...args: Array<never>) => void) => {
        const events = registered.get(connection) ?? new Map<string, Array<(...args: Array<never>) => void>>()
        events.set(event, [...(events.get(event) ?? []), listener])
        registered.set(connection, events)
        return connection
    }
    /** Emits an event on a connection to the listeners the hub registered, as ioredis does. */
    const emitOn = (connection: RedisConnection, event: string, ...args: Array<unknown>): void => {
        for (const listener of registered.get(connection)?.get(event) ?? []) Reflect.apply(listener, connection, args)
    }
    const emitMessage = (message: string): void => emitOn(subscriber, "message", "app", message)
    subscriber.on.mockImplementation(register(subscriber))
    publisher.on.mockImplementation(register(publisher))
    subscriber.subscribe.mockImplementation(() => {
        if (options.readyDuringBoot) emitOn(subscriber, "ready")
        return Promise.resolve(1)
    })
    subscriber.quit.mockResolvedValue("OK")
    publisher.quit.mockResolvedValue("OK")
    publisher.eval.mockImplementation((_script, _keys, ...args) => {
        const [key, , id, json, , channel, topic] = args.map(String)
        const entries = streams.get(key ?? "") ?? []
        const position = `${entries.length + 1}-0`
        entries.push([position, ["id", id ?? "", "data", json ?? ""]])
        streams.set(key ?? "", entries)
        emitOn(subscriber, "message", channel ?? "", JSON.stringify({ topic, position, frame: json }))
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
    publisher.publish.mockImplementation((channel, message) => {
        emitOn(subscriber, "message", channel, message)
        return Promise.resolve(1)
    })
    const logger = mock<Logger>()
    const timer = mock<Timer>()
    const cancelRetry = jest.fn()
    timer.schedule.mockReturnValue(cancelRetry)
    const moduleRef = await Test.createTestingModule({
        providers: [
            RedisReloadingHubService,
            { provide: REALTIME_REDIS_PUBLISHER, useValue: publisher },
            { provide: REALTIME_REDIS_SUBSCRIBER, useValue: subscriber },
            { provide: REALTIME_REDIS_OPTIONS, useValue: OPTIONS },
            { provide: LOGGER, useValue: logger },
            { provide: REALTIME_TIMER, useValue: timer },
        ],
    }).compile()
    const hub = moduleRef.get(RedisReloadingHubService)
    await hub.onModuleInit()
    const reconnect = (): void => {
        emitOn(subscriber, "ready")
    }
    return { hub, publisher, subscriber, logger, timer, cancelRetry, streams, emitOn, emitMessage, reconnect }
}
describe("RedisReloadingHubService live delivery", () => {
    it("subscribes to the prefixed hub channel and hands a published frame to every subscription of the topic, in order", async () => {
        const { hub, subscriber } = await build()
        const topic = topicOf("t:live")
        const first = hub.subscribe(topic)[Symbol.asyncIterator]()
        const second = hub.subscribe(topic)[Symbol.asyncIterator]()
        expect(hub.subscriberCount(topic)).toBe(2)

        await hub.publish(topic, frameOf(1))
        await hub.publish(topic, frameOf(2))

        expect(subscriber.subscribe).toHaveBeenCalledWith("app")
        await expect(first.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await expect(first.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        await expect(second.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await first.return?.()
        await second.return?.()
        expect(hub.subscriberCount(topic)).toBe(0)
    })

    it("delivers only to the topic the frame was published to", async () => {
        const { hub } = await build()
        const mine = hub.subscribe(topicOf("t:mine"))[Symbol.asyncIterator]()
        const other = hub.subscribe(topicOf("t:other"))[Symbol.asyncIterator]()

        await hub.publish(topicOf("t:other"), frameOf(1))
        await hub.publish(topicOf("t:mine"), frameOf(2))

        await expect(mine.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        await expect(other.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await mine.return?.()
        await other.return?.()
    })

    it("publishes a frame without a string id with no stream entry, so nothing of it can be resumed", async () => {
        const { hub, streams, publisher } = await build()
        const topic: RealtimeTopic<{ readonly value: number }> = {
            name: "t:noid",
            accepts: (value: unknown): value is { readonly value: number } => value !== undefined,
        }
        const reader = hub.subscribe(topic)[Symbol.asyncIterator]()

        await hub.publish(topic, { value: 7 })

        await expect(reader.next()).resolves.toEqual({ done: false, value: { value: 7 } })
        expect(streams.has("app:t:noid")).toBe(false)
        expect(publisher.eval).not.toHaveBeenCalled()
        expect(publisher.publish).toHaveBeenCalledWith(
            "app",
            JSON.stringify({ topic: "t:noid", position: "", frame: '{"value":7}' }),
        )
        await reader.return?.()
    })

    it("ignores a message that is not the shape the hub publishes", async () => {
        const { hub, emitMessage, logger } = await build()
        const reader = hub.subscribe(topicOf("t:bad"))[Symbol.asyncIterator]()

        emitMessage("garbage")

        expect(logger.warn).toHaveBeenCalledWith(RealtimeLogEvent.NotificationIgnored)
        await reader.return?.()
    })

    it("logs a failure of either connection instead of leaving it to the client console", async () => {
        const { publisher, subscriber, emitOn, logger } = await build()

        emitOn(publisher, "error", new Error("publisher reset"))
        emitOn(subscriber, "error", new Error("subscriber reset"))

        expect(logger.warn).toHaveBeenCalledWith(RealtimeLogEvent.RedisFailed, { cause: "publisher reset" })
        expect(logger.warn).toHaveBeenCalledWith(RealtimeLogEvent.RedisFailed, { cause: "subscriber reset" })
    })
})

describe("RedisReloadingHubService reconnect of the subscriber connection", () => {
    it("reloads, for each followed topic, what the stream gained after the newest id it delivered", async () => {
        const { hub, publisher, streams, reconnect } = await build()
        const topic = topicOf("t:down")
        const reader = hub.subscribe(topic)[Symbol.asyncIterator]()
        await settle()
        await hub.publish(topic, frameOf(1))
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        streams.get("app:t:down")?.push(entryOf("2-0", frameOf(2)), entryOf("3-0", frameOf(3)))

        reconnect()

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(3) })
        expect(publisher.xrange).toHaveBeenLastCalledWith("app:t:down", "(1-0", "+")
        await reader.return?.()
    })

    it("subscribes to the channel again before it reads the streams, so no frame falls between the two", async () => {
        const { hub, publisher, subscriber, reconnect } = await build()
        const reader = hub.subscribe(topicOf("t:order"))[Symbol.asyncIterator]()
        await settle()
        publisher.xrange.mockClear()

        reconnect()
        await settle()

        expect(subscriber.subscribe).toHaveBeenCalledTimes(2)
        expect(subscriber.subscribe.mock.invocationCallOrder[1]).toBeLessThan(
            publisher.xrange.mock.invocationCallOrder[0] ?? 0,
        )
        await reader.return?.()
    })

    it("reloads a new topic followed while resubscribing, including frames retained before the channel became active", async () => {
        const { hub, publisher, subscriber, streams, emitMessage, reconnect } = await build()
        const gate = gateOf()
        subscriber.subscribe.mockImplementationOnce(async () => {
            await gate.opened
            return 1
        })
        reconnect()
        await settle()
        const topic = topicOf("t:joining")
        streams.set("app:t:joining", [entryOf("1-0", frameOf(1))])
        const reader = hub.subscribe(topic)[Symbol.asyncIterator]()
        await settle()
        streams.get("app:t:joining")?.push(entryOf("2-0", frameOf(2)))

        gate.release()

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        expect(publisher.xrange).toHaveBeenLastCalledWith("app:t:joining", "(1-0", "+")
        await settle()
        emitMessage(messageOf("t:joining", "3-0", frameOf(3)))
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(3) })
        await reader.return?.()
    })

    it("reloads a topic that was quiet since it was followed, from where the stream stood when the subscription joined", async () => {
        const { hub, streams, reconnect } = await build()
        const topic = topicOf("t:quiet")
        streams.set("app:t:quiet", [entryOf("1-0", frameOf(1))])
        const reader = hub.subscribe(topic)[Symbol.asyncIterator]()
        await settle()
        streams.get("app:t:quiet")?.push(entryOf("2-0", frameOf(2)))

        reconnect()

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        await reader.return?.()
    })
})

describe("RedisReloadingHubService reconnect of the subscriber connection (part 2)", () => {
    it("reloads a followed topic whose stream was empty when the subscription joined", async () => {
        const { hub, streams, reconnect } = await build()
        const reader = hub.subscribe(topicOf("t:empty"))[Symbol.asyncIterator]()
        await settle()
        streams.set("app:t:empty", [entryOf("1-0", frameOf(1))])

        reconnect()

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await reader.return?.()
    })
})

describe("RedisReloadingHubService held messages during a reconnect", () => {
    it("holds the live messages until the reload finished, and drops the ones the reload already delivered", async () => {
        const { hub, publisher, streams, emitMessage, reconnect } = await build()
        const topic = topicOf("t:held")
        streams.set("app:t:held", [entryOf("1-0", frameOf(1))])
        const reader = hub.subscribe(topic)[Symbol.asyncIterator]()
        await settle()
        const gate = gateOf()
        const answer = publisher.xrange.getMockImplementation()
        publisher.xrange.mockImplementationOnce(async (key, start, end) => {
            await gate.opened
            return answer ? answer(key, start, end) : []
        })
        streams.get("app:t:held")?.push(entryOf("2-0", frameOf(2)), entryOf("3-0", frameOf(3)))

        reconnect()
        emitMessage(messageOf("t:held", "3-0", frameOf(3)))
        emitMessage(messageOf("t:held", "4-0", frameOf(4)))
        gate.release()

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(3) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(4) })
        await reader.return?.()
    })

    it("keeps the messages of the newer connection held when a second reconnect overtakes a reload", async () => {
        const { hub, publisher, streams, emitMessage, reconnect } = await build()
        streams.set("app:t:flap", [entryOf("1-0", frameOf(1))])
        const reader = hub.subscribe(topicOf("t:flap"))[Symbol.asyncIterator]()
        await settle()
        const first = gateOf()
        const second = gateOf()
        const answer = publisher.xrange.getMockImplementation()
        const gated =
            (gate: Gate) =>
            async (key: string, start: string, end: string): Promise<RedisStreamReply> => {
                await gate.opened
                return answer ? answer(key, start, end) : []
            }
        publisher.xrange.mockImplementationOnce(gated(first)).mockImplementationOnce(gated(second))
        streams.get("app:t:flap")?.push(entryOf("2-0", frameOf(2)))

        reconnect()
        await settle()
        reconnect()
        emitMessage(messageOf("t:flap", "3-0", frameOf(3)))
        first.release()
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        streams.get("app:t:flap")?.push(entryOf("3-0", frameOf(3)))
        const next = reader.next()
        const early = await Promise.race([next, settle().then(() => "held")])
        second.release()

        expect(early).toBe("held")
        await expect(next).resolves.toEqual({ done: false, value: frameOf(3) })
        await reader.return?.()
    })

    it("lets a held frame that has no stream position through", async () => {
        const { hub, emitMessage, reconnect } = await build()
        const reader = hub.subscribe(topicOf("t:nopos"))[Symbol.asyncIterator]()
        await settle()

        reconnect()
        emitMessage(JSON.stringify({ topic: "t:nopos", position: "", frame: JSON.stringify(frameOf(5)) }))

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(5) })
        await reader.return?.()
    })
})
