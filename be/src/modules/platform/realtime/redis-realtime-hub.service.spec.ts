import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { REALTIME_TIMER } from "./realtime.decorators"
import type { Timer } from "@modules/platform/retry"
import { RECONNECT_DELAY_MS } from "./realtime.contracts"
import { REALTIME_REDIS_OPTIONS, REALTIME_REDIS_PUBLISHER, REALTIME_REDIS_SUBSCRIBER } from "./realtime.decorators"
import { RealtimeLogEvent } from "./realtime.log-events"
import type { RealtimeTopic } from "./realtime.port"
import type { RedisConnection, RedisStreamReply } from "./redis-realtime.port"
import { RealtimeError, RealtimeErrorCode } from "./errors/realtime.error"
import { RedisRealtimeHubService } from "./redis-realtime-hub.service"
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
            RedisRealtimeHubService,
            { provide: REALTIME_REDIS_PUBLISHER, useValue: publisher },
            { provide: REALTIME_REDIS_SUBSCRIBER, useValue: subscriber },
            { provide: REALTIME_REDIS_OPTIONS, useValue: OPTIONS },
            { provide: LOGGER, useValue: logger },
            { provide: REALTIME_TIMER, useValue: timer },
        ],
    }).compile()
    const hub = moduleRef.get(RedisRealtimeHubService)
    await hub.onModuleInit()
    const reconnect = (): void => {
        emitOn(subscriber, "ready")
    }
    return { hub, publisher, subscriber, logger, timer, cancelRetry, streams, emitOn, emitMessage, reconnect }
}
describe("RedisRealtimeHubService reconnect bookkeeping", () => {
    it("keeps held messages paused after a failed reload, retries, then delivers every retained frame once", async () => {
        const { hub, publisher, logger, streams, emitMessage, reconnect, timer } = await build()
        const reader = hub.subscribe(topicOf("t:fail"))[Symbol.asyncIterator]()
        await settle()
        streams.set("app:t:fail", [entryOf("1-0", frameOf(1))])
        publisher.xrange.mockRejectedValueOnce(new Error("redis down"))

        reconnect()
        emitMessage(messageOf("t:fail", "1-0", frameOf(1)))
        emitMessage(messageOf("t:fail", "2-0", frameOf(2)))
        const next = reader.next()
        await expect(Promise.race([next, settle().then(() => "held")])).resolves.toBe("held")
        expect(logger.error).toHaveBeenCalledWith(RealtimeLogEvent.CatchUpFailed, expect.any(Error))
        expect(timer.schedule).toHaveBeenCalledWith(expect.any(Function), RECONNECT_DELAY_MS)
        const retry = timer.schedule.mock.calls[0]?.[0]
        retry?.()

        await expect(next).resolves.toEqual({ done: false, value: frameOf(1) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        emitMessage(messageOf("t:fail", "3-0", frameOf(3)))
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(3) })
        expect(publisher.xrange).toHaveBeenLastCalledWith("app:t:fail", "(0-0", "+")
        await reader.return?.()
    })

    it("cancels an old retry when a new generation reconnects, and ignores its callback", async () => {
        const { hub, publisher, subscriber, reconnect, timer, cancelRetry } = await build()
        const reader = hub.subscribe(topicOf("t:retry"))[Symbol.asyncIterator]()
        await settle()
        publisher.xrange.mockRejectedValueOnce(new Error("read failed"))
        reconnect()
        await settle()
        const retry = timer.schedule.mock.calls[0]?.[0]

        reconnect()
        await settle()
        const subscriptions = subscriber.subscribe.mock.calls.length
        retry?.()
        await settle()

        expect(cancelRetry).toHaveBeenCalled()
        expect(subscriber.subscribe).toHaveBeenCalledTimes(subscriptions)
        await reader.return?.()
    })

    it("cancels a retry on shutdown and ignores a callback already queued by the timer", async () => {
        const { hub, publisher, subscriber, reconnect, timer, cancelRetry } = await build()
        const reader = hub.subscribe(topicOf("t:stopped"))[Symbol.asyncIterator]()
        await settle()
        publisher.xrange.mockRejectedValueOnce(new Error("read failed"))
        reconnect()
        await settle()
        const retry = timer.schedule.mock.calls[0]?.[0]

        await hub.onModuleDestroy()
        const subscriptions = subscriber.subscribe.mock.calls.length
        retry?.()
        await settle()

        expect(cancelRetry).toHaveBeenCalled()
        expect(subscriber.subscribe).toHaveBeenCalledTimes(subscriptions)
        await expect(reader.next()).resolves.toEqual({ done: true, value: undefined })
    })
})

describe("RedisRealtimeHubService reconnect bookkeeping (part 2)", () => {
    it("does not schedule a retry for a failed reload overtaken by a newer generation", async () => {
        const { hub, publisher, streams, reconnect, timer } = await build()
        const reader = hub.subscribe(topicOf("t:overtaken"))[Symbol.asyncIterator]()
        await settle()
        const gate = gateOf()
        publisher.xrange.mockImplementationOnce(async () => {
            await gate.opened
            throw new RealtimeError({ code: RealtimeErrorCode.ReplayFailed })
        })
        reconnect()
        await settle()
        streams.set("app:t:overtaken", [entryOf("1-0", frameOf(1))])
        reconnect()
        gate.release()

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        expect(timer.schedule).not.toHaveBeenCalled()
        await reader.return?.()
    })

    it("does not schedule a retry when an in-flight reload fails during shutdown", async () => {
        const { hub, publisher, reconnect, timer } = await build()
        hub.subscribe(topicOf("t:closing"))[Symbol.asyncIterator]()
        await settle()
        const gate = gateOf()
        publisher.xrange.mockImplementationOnce(async () => {
            await gate.opened
            throw new RealtimeError({ code: RealtimeErrorCode.ReplayFailed })
        })
        reconnect()
        await settle()
        const closing = hub.onModuleDestroy()
        gate.release()
        await closing

        expect(timer.schedule).not.toHaveBeenCalled()
    })

    it("forgets a topic nobody follows any more, and reads nothing for it", async () => {
        const { hub, publisher, reconnect } = await build()
        const reader = hub.subscribe(topicOf("t:left"))[Symbol.asyncIterator]()
        await settle()
        await reader.return?.()
        publisher.xrange.mockClear()

        reconnect()
        await settle()

        expect(publisher.xrange).not.toHaveBeenCalled()
    })

    it("reloads from the initial floor while a topic's first read is still pending", async () => {
        const { hub, publisher, reconnect } = await build()
        const gate = gateOf()
        const answer = publisher.xrange.getMockImplementation()
        publisher.xrange.mockImplementationOnce(async (key, start, end) => {
            await gate.opened
            return answer ? answer(key, start, end) : []
        })
        const reader = hub.subscribe(topicOf("t:pending"))[Symbol.asyncIterator]()
        publisher.xrange.mockClear()

        reconnect()
        await settle()
        gate.release()
        await settle()

        expect(publisher.xrange).toHaveBeenCalledWith("app:t:pending", "(0-0", "+")
        await reader.return?.()
    })
})

describe("RedisRealtimeHubService reconnect bookkeeping (part 3)", () => {
    it("does not reload when the connection is ready for the first time during boot", async () => {
        const { hub, publisher } = await build({ readyDuringBoot: true })
        const reader = hub.subscribe(topicOf("t:boot"))[Symbol.asyncIterator]()
        await settle()

        expect(publisher.xrange).toHaveBeenCalledTimes(1)
        await reader.return?.()
    })

    it("keeps the newest position when a stale one arrives, and ignores a position for a topic nobody follows", async () => {
        const { hub, emitMessage, publisher, reconnect } = await build()
        const reader = hub.subscribe(topicOf("t:order"))[Symbol.asyncIterator]()
        await settle()
        emitMessage(messageOf("t:order", "5-0", frameOf(5)))
        emitMessage(messageOf("t:order", "4-0", frameOf(4)))
        emitMessage(messageOf("t:nobody", "9-0", frameOf(9)))
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(5) })
        const next = reader.next()
        await expect(Promise.race([next, settle().then(() => "waiting")])).resolves.toBe("waiting")
        emitMessage(messageOf("t:order", "6-0", frameOf(6)))
        await expect(next).resolves.toEqual({ done: false, value: frameOf(6) })

        reconnect()
        await settle()

        expect(publisher.xrange).toHaveBeenLastCalledWith("app:t:order", "(6-0", "+")
        await reader.return?.()
    })
})

describe("RedisRealtimeHubService receivers around an outage", () => {
    it.each([false, true])(
        "keeps older receivers' outage frames when another receiver joins (held: %s)",
        async (held) => {
            const { hub, publisher, streams, emitMessage, reconnect } = await build()
            const topic = topicOf("t:two")
            streams.set("app:t:two", [entryOf("1-0", frameOf(1))])
            const older = hub.subscribe(topic)[Symbol.asyncIterator]()
            await settle()
            streams.get("app:t:two")?.push(entryOf("2-0", frameOf(2)), entryOf("3-0", frameOf(3)))
            const gate = gateOf()
            if (held) {
                const answer = publisher.xrange.getMockImplementation()
                publisher.xrange.mockImplementationOnce(async (key, start, end) => {
                    await gate.opened
                    return answer ? answer(key, start, end) : []
                })
                reconnect()
                await settle()
                emitMessage(messageOf("t:two", "2-0", frameOf(2)))
                emitMessage(messageOf("t:two", "3-0", frameOf(3)))
            }
            const newer = hub.subscribe(topic)[Symbol.asyncIterator]()
            await settle()
            if (held) gate.release()
            else reconnect()

            await expect(older.next()).resolves.toEqual({ done: false, value: frameOf(2) })
            await expect(older.next()).resolves.toEqual({ done: false, value: frameOf(3) })
            await settle()
            emitMessage(messageOf("t:two", "4-0", frameOf(4)))
            await expect(older.next()).resolves.toEqual({ done: false, value: frameOf(4) })
            await expect(newer.next()).resolves.toEqual({ done: false, value: frameOf(4) })
            await older.return?.()
            await newer.return?.()
        },
    )

    it("does not give an in-flight reload's older rows to a receiver that followed the topic again", async () => {
        const { hub, publisher, streams, reconnect, emitMessage } = await build()
        const topic = topicOf("t:refollow")
        streams.set("app:t:refollow", [entryOf("1-0", frameOf(1))])
        const first = hub.subscribe(topic)[Symbol.asyncIterator]()
        await settle()
        const gate = gateOf()
        publisher.xrange.mockImplementationOnce(async () => {
            await gate.opened
            return [entryOf("2-0", frameOf(2))]
        })
        reconnect()
        await settle()
        await first.return?.()
        streams.get("app:t:refollow")?.push(entryOf("2-0", frameOf(2)), entryOf("3-0", frameOf(3)))
        const second = hub.subscribe(topic)[Symbol.asyncIterator]()
        await settle()
        gate.release()
        await settle()
        emitMessage(messageOf("t:refollow", "4-0", frameOf(4)))

        await expect(second.next()).resolves.toEqual({ done: false, value: frameOf(4) })
        await second.return?.()
    })
})

describe("RedisRealtimeHubService receivers around an outage (part 2)", () => {
    it("skips a topic released while another topic's reload is in flight", async () => {
        const { hub, publisher, reconnect } = await build()
        const first = hub.subscribe(topicOf("t:first"))[Symbol.asyncIterator]()
        const second = hub.subscribe(topicOf("t:second"))[Symbol.asyncIterator]()
        await settle()
        const gate = gateOf()
        publisher.xrange.mockImplementationOnce(async () => {
            await gate.opened
            return []
        })
        publisher.xrange.mockClear()
        reconnect()
        await settle()
        await second.return?.()
        gate.release()
        await settle()

        expect(publisher.xrange).toHaveBeenCalledTimes(1)
        expect(publisher.xrange).toHaveBeenCalledWith("app:t:first", "(0-0", "+")
        await first.return?.()
    })
})

describe("RedisRealtimeHubService shutdown", () => {
    it("closes both connections when the app shuts down", async () => {
        const { hub, publisher, subscriber } = await build()

        await hub.onModuleDestroy()

        expect(publisher.quit).toHaveBeenCalledTimes(1)
        expect(subscriber.quit).toHaveBeenCalledTimes(1)
    })

    it("ends a reader still waiting when the app shuts down, so nothing holds a handle", async () => {
        const { hub } = await build()
        const reader = hub.subscribe(topicOf("t:bye"))[Symbol.asyncIterator]()
        const pending = reader.next()

        await hub.onModuleDestroy()

        await expect(pending).resolves.toEqual({ done: true, value: undefined })
    })

    it("lets a reload already queued settle before it is destroyed", async () => {
        const { hub, publisher, streams, reconnect } = await build()
        const topic = topicOf("t:settle")
        hub.subscribe(topic)[Symbol.asyncIterator]()
        await settle()
        streams.set("app:t:settle", [entryOf("1-0", frameOf(1))])
        let read = false
        const answer = publisher.xrange.getMockImplementation()
        const gate = gateOf()
        publisher.xrange.mockImplementationOnce(async (key, start, end) => {
            await gate.opened
            read = true
            return answer ? answer(key, start, end) : []
        })
        reconnect()

        let readWhenDestroyed = false
        const destroyed = hub.onModuleDestroy().then(() => {
            readWhenDestroyed = read
        })
        gate.release()
        await destroyed

        expect(readWhenDestroyed).toBe(true)
    })

    it("ignores a reconnect that arrives after shutdown: no subscribe, no reload", async () => {
        const { hub, publisher, subscriber, reconnect } = await build()
        hub.subscribe(topicOf("t:off"))
        await hub.onModuleDestroy()
        subscriber.subscribe.mockClear()
        publisher.xrange.mockClear()

        reconnect()
        await settle()

        expect(subscriber.subscribe).not.toHaveBeenCalled()
        expect(publisher.xrange).not.toHaveBeenCalled()
    })
})
