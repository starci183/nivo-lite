import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { Timer } from "@modules/platform/retry"
import { PostgresListenerClient } from "./postgres-listener.client"
import type { ListenConnection, ListenFactory, ListenHandlers, ListenMessage } from "./postgres-listener.port"
import { PROBE_PREFIX, PROBE_TIMEOUT_MS, RECONNECT_DELAY_MS } from "./realtime.contracts"
import { REALTIME_TIMER, REALTIME_LISTEN_FACTORY, REALTIME_POSTGRES_OPTIONS } from "./realtime.decorators"
import { RealtimeLogEvent } from "./realtime.log-events"

/** A connection whose events a spec drives; `fail` makes the named step reject. */
class FakeConnection implements ListenConnection {
    private readonly listeners = new Map<string, Array<(...args: Array<never>) => void>>()
    readonly statements: Array<string> = []
    ended = 0
    failConnect = false
    failQuery = false
    /** A connection behind a transaction pooler: it accepts LISTEN and never delivers the probe. */
    silent = false
    /** Holds `connect` until the spec releases it. */
    gate: Promise<void> | undefined
    /** Runs while `connect` is in flight, after the gate: the spec drops the connection mid-open with it. */
    duringConnect: (() => void) | undefined

    on(event: "notification", listener: (message: ListenMessage) => void): unknown
    on(event: "error", listener: (cause: Error) => void): unknown
    on(event: "end", listener: () => void): unknown
    on(event: string, listener: (...args: Array<never>) => void): unknown {
        this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener])
        return this
    }

    private emit(event: string, ...args: Array<unknown>): void {
        for (const listener of this.listeners.get(event) ?? []) Reflect.apply(listener, this, args)
    }

    emitNotification(message: ListenMessage): void {
        this.emit("notification", message)
    }

    emitError(cause: Error): void {
        this.emit("error", cause)
    }

    emitEnd(): void {
        this.emit("end")
    }

    async connect(): Promise<unknown> {
        await this.gate
        this.duringConnect?.()
        return this.failConnect ? Promise.reject(new Error("connect refused")) : Promise.resolve()
    }

    query(text: string): Promise<unknown> {
        this.statements.push(text)
        return this.failQuery ? Promise.reject(new Error("listen refused")) : Promise.resolve({})
    }

    end(): Promise<void> {
        this.ended += 1
        return Promise.resolve()
    }
}

const build = async () => {
    const connections: Array<FakeConnection> = []
    const factory = mock<ListenFactory>()
    factory.create.mockImplementation(() => {
        const connection = new FakeConnection()
        connections.push(connection)
        return connection
    })
    const scheduled: Array<{ readonly callback: () => void; readonly delayMs: number; cancelled: boolean }> = []
    const probes: Array<{ readonly callback: () => void; readonly delayMs: number; cancelled: boolean }> = []
    const timer = mock<Timer>()
    timer.schedule.mockImplementation((callback, delayMs) => {
        const entry = { callback, delayMs, cancelled: false }
        ;(delayMs === PROBE_TIMEOUT_MS ? probes : scheduled).push(entry)
        return () => {
            entry.cancelled = true
        }
    })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PostgresListenerClient,
            {
                provide: REALTIME_POSTGRES_OPTIONS,
                useValue: { hub: "postgres", connection: "c", url: new Secret("postgres://hub") },
            },
            { provide: REALTIME_LISTEN_FACTORY, useValue: factory },
            { provide: REALTIME_TIMER, useValue: timer },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    const handlers = mock<ListenHandlers>()
    handlers.probe.mockImplementation((payload) => {
        const latest = connections.at(-1)
        if (latest && !latest.silent) latest.emitNotification({ payload })
        return Promise.resolve()
    })
    return { client: moduleRef.get(PostgresListenerClient), connections, factory, scheduled, probes, logger, handlers }
}
describe("PostgresListenerClient start", () => {
    it("opens one connection to the session-mode url and listens on the hub channel", async () => {
        const { client, connections, factory, handlers } = await build()

        await client.start(handlers)

        expect(factory.create).toHaveBeenCalledWith("postgres://hub")
        expect(connections).toHaveLength(1)
        expect(connections[0]?.statements).toEqual(["LISTEN realtime_events"])
    })

    it("proves the connection carries notifications by hearing the probe the hub sends from another session, and does not hand the probe to the hub", async () => {
        const { client, probes, handlers } = await build()

        await client.start(handlers)

        expect(handlers.notify).not.toHaveBeenCalled()
        expect(probes).toHaveLength(1)
        expect(probes[0]?.cancelled).toBe(true)
    })

    it("does not hand the probe of another replica to the hub either", async () => {
        const { client, connections, handlers } = await build()
        await client.start(handlers)

        connections[0]?.emitNotification({ payload: `${PROBE_PREFIX}another-replica` })

        expect(handlers.notify).not.toHaveBeenCalled()
    })

    it("sends a random probe payload from the hub on every connection it opens", async () => {
        const { client, connections, handlers } = await build()
        await client.start(handlers)
        connections[0]?.emitEnd()

        const [first] = handlers.probe.mock.calls[0] ?? []

        expect(first?.startsWith(PROBE_PREFIX)).toBe(true)
        expect(first).toHaveLength(PROBE_PREFIX.length + 16)
    })

    it("fails the boot after a silent probe and can be stopped without closing the connection twice", async () => {
        const { client, connections, factory, probes, handlers, scheduled } = await build()
        factory.create.mockImplementationOnce(() => {
            const connection = new FakeConnection()
            connection.silent = true
            connections.push(connection)
            return connection
        })

        const started = client.start(handlers)
        await new Promise<void>((resolve) => setImmediate(resolve))
        probes[0]?.callback()

        await expect(started).rejects.toThrow("REALTIME_LISTEN_SILENT")
        expect(connections[0]?.ended).toBe(1)

        await client.stop()

        expect(connections[0]?.ended).toBe(1)
        expect(scheduled).toHaveLength(0)
    })

    it("hands every notification payload to the hub, an empty one as an empty string", async () => {
        const { client, connections, handlers } = await build()
        await client.start(handlers)

        connections[0]?.emitNotification({ payload: '{"seq":1}' })
        connections[0]?.emitNotification({})

        expect(handlers.notify).toHaveBeenNthCalledWith(1, '{"seq":1}')
        expect(handlers.notify).toHaveBeenNthCalledWith(2, "")
    })
})

describe("PostgresListenerClient failed start", () => {
    it("fails the boot when the first connection cannot open, and closes it", async () => {
        const { client, connections, factory, handlers } = await build()
        factory.create.mockImplementationOnce(() => {
            const connection = new FakeConnection()
            connection.failConnect = true
            connections.push(connection)
            return connection
        })

        await expect(client.start(handlers)).rejects.toMatchObject({
            code: "REALTIME_LISTEN_DROPPED",
            cause: new Error("connect refused"),
        })
        expect(connections[0]?.ended).toBe(1)
    })

    it("fails the boot with REALTIME_LISTEN_DROPPED when the connection dies while it is still opening", async () => {
        const { client, connections, factory, handlers } = await build()
        factory.create.mockImplementationOnce(() => {
            const connection = new FakeConnection()
            connection.duringConnect = () => connection.emitEnd()
            connections.push(connection)
            return connection
        })

        await expect(client.start(handlers)).rejects.toThrow("REALTIME_LISTEN_DROPPED")
        expect(connections[0]?.ended).toBe(1)
    })

    it("closes a connection whose LISTEN was refused and fails the boot", async () => {
        const { client, connections, factory, handlers } = await build()
        factory.create.mockImplementationOnce(() => {
            const connection = new FakeConnection()
            connection.failQuery = true
            connections.push(connection)
            return connection
        })

        await expect(client.start(handlers)).rejects.toMatchObject({
            code: "REALTIME_LISTEN_DROPPED",
            cause: new Error("listen refused"),
        })

        expect(connections[0]?.ended).toBe(1)
    })
})

describe("PostgresListenerClient reconnect", () => {
    it("logs a lost connection, opens a new one after the pause and tells the hub it resumed", async () => {
        const { client, connections, scheduled, logger, handlers } = await build()
        await client.start(handlers)

        connections[0]?.emitError(new Error("terminated"))
        expect(logger.warn).toHaveBeenCalledWith(RealtimeLogEvent.ListenLost, { cause: "terminated" })
        expect(scheduled).toHaveLength(1)
        expect(scheduled[0]?.delayMs).toBe(RECONNECT_DELAY_MS)
        scheduled[0]?.callback()
        await new Promise<void>((resolve) => setImmediate(resolve))

        expect(connections).toHaveLength(2)
        expect(connections[1]?.statements).toEqual(["LISTEN realtime_events"])
        expect(handlers.resumed).toHaveBeenCalledTimes(1)
    })
})

describe("PostgresListenerClient loss", () => {
    it("tells the hub the moment the connection is lost and closes the dead client", async () => {
        const { client, connections, handlers } = await build()
        await client.start(handlers)

        connections[0]?.emitError(new Error("terminated"))

        expect(handlers.lost).toHaveBeenCalledTimes(1)
        expect(handlers.resumed).not.toHaveBeenCalled()
        expect(connections[0]?.ended).toBe(1)
    })

    it("logs, and does not fail, when the dead client cannot be closed", async () => {
        const { client, connections, logger, handlers } = await build()
        await client.start(handlers)
        const dead = connections[0]
        if (dead) dead.end = () => Promise.reject(new Error("already gone"))

        dead?.emitEnd()
        await new Promise<void>((resolve) => setImmediate(resolve))

        expect(handlers.lost).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledTimes(2)
    })

    it("treats a closed connection without an error as lost too, and reports each loss once", async () => {
        const { client, connections, scheduled, logger, handlers } = await build()
        await client.start(handlers)

        connections[0]?.emitEnd()
        connections[0]?.emitError(new Error("after the end"))

        expect(logger.warn).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith(RealtimeLogEvent.ListenLost, { cause: "closed" })
        expect(scheduled).toHaveLength(1)
    })

    it("logs a failed reconnect and tries again after the pause until it succeeds", async () => {
        const { client, connections, factory, scheduled, logger, handlers } = await build()
        await client.start(handlers)
        factory.create.mockImplementationOnce(() => {
            const connection = new FakeConnection()
            connection.failConnect = true
            connections.push(connection)
            return connection
        })
        connections[0]?.emitEnd()

        scheduled[0]?.callback()
        await new Promise<void>((resolve) => setImmediate(resolve))
        expect(logger.error).toHaveBeenCalledWith(
            RealtimeLogEvent.ListenFailed,
            expect.objectContaining({ code: "REALTIME_LISTEN_DROPPED" }),
        )
        expect(handlers.resumed).not.toHaveBeenCalled()
        expect(scheduled).toHaveLength(2)
        scheduled[1]?.callback()
        await new Promise<void>((resolve) => setImmediate(resolve))

        expect(handlers.resumed).toHaveBeenCalledTimes(1)
    })
})

describe("PostgresListenerClient loss (part 2)", () => {
    it("ends a connection that is lost while it is still opening, and reconnects like a failed open", async () => {
        const { client, connections, factory, scheduled, logger, handlers } = await build()
        await client.start(handlers)
        factory.create.mockImplementationOnce(() => {
            const connection = new FakeConnection()
            connection.duringConnect = () => connection.emitError(new Error("dropped mid-open"))
            connections.push(connection)
            return connection
        })
        connections[0]?.emitEnd()

        scheduled[0]?.callback()
        await new Promise<void>((resolve) => setImmediate(resolve))

        expect(connections[1]?.ended).toBe(1)
        expect(logger.error).toHaveBeenCalledWith(
            RealtimeLogEvent.ListenFailed,
            expect.objectContaining({ code: "REALTIME_LISTEN_DROPPED" }),
        )
        expect(handlers.resumed).not.toHaveBeenCalled()
        expect(scheduled).toHaveLength(2)
    })

    it("ignores the events of a connection it already replaced", async () => {
        const { client, connections, scheduled, logger, handlers } = await build()
        await client.start(handlers)
        connections[0]?.emitEnd()
        scheduled[0]?.callback()
        await new Promise<void>((resolve) => setImmediate(resolve))

        connections[0]?.emitError(new Error("late"))

        expect(logger.warn).toHaveBeenCalledTimes(1)
        expect(scheduled).toHaveLength(1)
    })
})

describe("PostgresListenerClient stop", () => {
    it("closes the connection and does not report the close as a loss", async () => {
        const { client, connections, scheduled, logger, handlers } = await build()
        await client.start(handlers)

        await client.stop()
        connections[0]?.emitEnd()

        expect(connections[0]?.ended).toBe(1)
        expect(logger.warn).not.toHaveBeenCalled()
        expect(scheduled).toHaveLength(0)
    })

    it("cancels a pending reconnect, and a reconnect that already fired does nothing", async () => {
        const { client, connections, scheduled, handlers } = await build()
        await client.start(handlers)
        connections[0]?.emitEnd()

        await client.stop()
        scheduled[0]?.callback()
        await new Promise<void>((resolve) => setImmediate(resolve))

        expect(scheduled[0]?.cancelled).toBe(true)
        expect(connections).toHaveLength(1)
        expect(handlers.resumed).not.toHaveBeenCalled()
    })

    it("closes a connection that finished opening after the listener was stopped, and does not report a resume", async () => {
        const { client, connections, factory, scheduled, handlers } = await build()
        await client.start(handlers)
        let release: () => void = () => undefined
        factory.create.mockImplementationOnce(() => {
            const connection = new FakeConnection()
            connection.gate = new Promise<void>((resolve) => {
                release = resolve
            })
            connections.push(connection)
            return connection
        })
        connections[0]?.emitEnd()
        scheduled[0]?.callback()
        await new Promise<void>((resolve) => setImmediate(resolve))

        await client.stop()
        release()
        await new Promise<void>((resolve) => setImmediate(resolve))

        expect(connections[1]?.ended).toBe(1)
        expect(handlers.resumed).not.toHaveBeenCalled()
    })

    it("releases the probe wait and closes a connection still opening when stop runs, scheduling nothing", async () => {
        const { client, connections, factory, probes, scheduled, handlers } = await build()
        factory.create.mockImplementationOnce(() => {
            const connection = new FakeConnection()
            connection.silent = true
            connections.push(connection)
            return connection
        })
        const started = client.start(handlers)
        await new Promise<void>((resolve) => setImmediate(resolve))

        await client.stop()
        await started

        expect(probes[0]?.cancelled).toBe(true)
        expect(connections[0]?.ended).toBe(1)
        expect(scheduled).toHaveLength(0)
    })
})

describe("PostgresListenerClient stop (part 2)", () => {
    it("ends a reconnect that was already opening when stop ran, without logging or scheduling again", async () => {
        const { client, connections, factory, scheduled, logger, handlers } = await build()
        await client.start(handlers)
        let release: () => void = () => undefined
        factory.create.mockImplementationOnce(() => {
            const connection = new FakeConnection()
            connection.failConnect = true
            connection.gate = new Promise<void>((resolve) => {
                release = resolve
            })
            connections.push(connection)
            return connection
        })
        connections[0]?.emitEnd()
        scheduled[0]?.callback()
        await new Promise<void>((resolve) => setImmediate(resolve))

        await client.stop()
        release()
        await new Promise<void>((resolve) => setImmediate(resolve))

        expect(connections[1]?.ended).toBe(1)
        expect(logger.error).not.toHaveBeenCalled()
        expect(scheduled).toHaveLength(1)
        expect(scheduled[0]?.cancelled).toBe(true)
    })

    it("stops a listener that never started", async () => {
        const { client } = await build()

        await expect(client.stop()).resolves.toBeUndefined()
    })
})
