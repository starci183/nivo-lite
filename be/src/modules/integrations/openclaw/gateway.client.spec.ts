import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { Secret } from "@modules/platform/config"
import { OpenclawError, OpenclawErrorCode } from "./errors/openclaw.error"
import { GatewayClient } from "./gateway.client"
import type { GatewaySocket } from "./gateway.client"
import { OPENCLAW_OPTIONS, OPENCLAW_SOCKET_FACTORY } from "./openclaw.decorators"
import type { OpenclawOptions } from "./openclaw.options"

const SESSION = "agent:ws-1-chatbot:conv-1"

interface Sent {
    readonly id: string
    readonly method: string
    readonly params: Record<string, unknown>
}

/** A scripted socket: every request is answered on the next microtask unless the script says otherwise. */
class FakeSocket implements GatewaySocket {
    readonly sent: Array<Sent> = []
    closed = 0
    onCloseHook: (() => void) | null = null
    throwOnSend = false
    reply: (request: Sent) => Record<string, unknown> | null = () => ({ ok: true, payload: {} })
    private messageListener: (data: string) => void = () => undefined
    private errorListener: (message: string) => void = () => undefined
    private closeListener: (code: number) => void = () => undefined

    send(data: string): void {
        if (this.throwOnSend) throw new Error("socket is not open")
        const request = JSON.parse(data) as Sent & { type: string }
        this.sent.push(request)
        const answer = this.reply(request)
        if (answer !== null) void Promise.resolve().then(() => this.frame({ type: "res", id: request.id, ...answer }))
    }

    close(): void {
        this.closed += 1
        this.onCloseHook?.()
        // A real socket reports its close after close() was called.
        void Promise.resolve().then(() => this.closeListener(1000))
    }

    onMessage(listener: (data: string) => void): void {
        this.messageListener = listener
    }

    onError(listener: (message: string) => void): void {
        this.errorListener = listener
    }

    onClose(listener: (code: number) => void): void {
        this.closeListener = listener
    }

    frame(value: unknown): void {
        this.messageListener(JSON.stringify(value))
    }

    raw(text: string): void {
        this.messageListener(text)
    }

    challenge(): void {
        this.frame({ type: "event", event: "connect.challenge" })
    }

    assistant(text: unknown, extra: Record<string, unknown> = {}, sessionKey = SESSION): void {
        this.frame({
            type: "event",
            event: "session.message",
            payload: { sessionKey, message: { role: "assistant", content: text, ...extra } },
        })
    }

    fail(message: string): void {
        this.errorListener(message)
    }

    drop(code: number): void {
        this.closeListener(code)
    }
}

const flush = async (): Promise<void> => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve()
}

const optionsOf = (patch: Partial<OpenclawOptions> = {}): OpenclawOptions => ({
    gateway: { url: "ws://127.0.0.1:18789", auth: { kind: "token", token: new Secret("t") } },
    turnTimeoutMs: 90_000,
    configDir: undefined,
    gatewayStateDir: "/home/node/.openclaw",
    manageAgents: false,
    toolSecret: null,
    ...patch,
})

const requestOf = (
    patch: Partial<{ isFinal: (text: string) => boolean; sessionKey: string; timeoutMs: number }> = {},
) => ({
    agentId: "ws-1-chatbot",
    sessionKey: SESSION,
    message: "hello",
    idempotencyKey: "k-1",
    timeoutMs: 30_000,
    ...patch,
})

const build = async (options: OpenclawOptions = optionsOf()) => {
    const sockets: Array<FakeSocket> = []
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            GatewayClient,
            { provide: OPENCLAW_OPTIONS, useValue: options },
            {
                provide: OPENCLAW_SOCKET_FACTORY,
                useValue: (_url: string) => {
                    const socket = new FakeSocket()
                    sockets.push(socket)
                    return socket
                },
            },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client: moduleRef.get(GatewayClient), sockets, logger }
}

/** Runs one turn and answers it with a final contract reply. */
const answered = async (client: GatewayClient, sockets: Array<FakeSocket>, text = '{"reply":"hi"}') => {
    const turn = client.runTurn(requestOf(), new AbortController().signal)
    const socket = sockets[sockets.length - 1] as FakeSocket
    socket.challenge()
    await flush()
    socket.assistant(text)
    return turn
}

describe("GatewayClient", () => {
    afterEach(() => {
        jest.useRealTimers()
    })

    describe("enabled", () => {
        it("is true with a gateway and false without", async () => {
            expect((await build()).client.enabled).toBe(true)
            expect((await build(optionsOf({ gateway: null }))).client.enabled).toBe(false)
        })
    })

    describe("runTurn", () => {
        it("refuses a turn when no gateway is configured", async () => {
            const { client } = await build(optionsOf({ gateway: null }))

            await expect(client.runTurn(requestOf(), new AbortController().signal)).rejects.toMatchObject({
                code: OpenclawErrorCode.GatewayNotConfigured,
            })
        })

        it("walks the protocol and answers the final contract reply with the summed usage", async () => {
            const { client, sockets } = await build()
            const turn = client.runTurn(requestOf(), new AbortController().signal)
            const socket = sockets[0] as FakeSocket

            socket.challenge()
            await flush()
            socket.assistant("thinking", {
                stopReason: "toolUse",
                usage: { input: 3, output: 1, cacheRead: 0, cacheWrite: 0, cost: { total: 0.1 } },
            })
            socket.assistant('{"reply":"Hi!"}', {
                stopReason: "stop",
                provider: "p",
                model: "m",
                usage: { input: 5, output: 2, cacheRead: 4, cacheWrite: 1, cost: { total: 0.2 } },
            })
            const result = await turn

            expect(socket.sent.map((s) => s.method)).toEqual([
                "connect",
                "sessions.create",
                "sessions.subscribe",
                "sessions.messages.subscribe",
                "sessions.send",
            ])
            expect(socket.sent[0]?.params).toMatchObject({ auth: { token: "t" }, role: "operator" })
            expect(socket.sent[4]?.params).toMatchObject({
                key: SESSION,
                message: "hello",
                idempotencyKey: "k-1",
                timeoutMs: 30_000,
            })
            expect(result.text).toBe('{"reply":"Hi!"}')
            expect(result.usage).toEqual({
                prompt_tokens: 13,
                completion_tokens: 3,
                cached_tokens: 4,
                cost: expect.closeTo(0.3, 5),
                model: "p/m",
            })
            expect(Object.keys(result.timings)).toEqual([
                "connect",
                "create",
                "subscribe",
                "send_ack",
                "reply",
                "total",
            ])
            expect(socket.closed).toBe(1)
        })

        it("answers no usage when the gateway reported none and reuses a created session", async () => {
            const { client, sockets } = await build()

            const first = await answered(client, sockets)
            const second = await answered(client, sockets)

            expect(first.usage).toBeNull()
            expect(second.text).toBe('{"reply":"hi"}')
            expect((sockets[1] as FakeSocket).sent.map((s) => s.method)).not.toContain("sessions.create")
        })

        it("goes on when the session already exists", async () => {
            const { client, sockets } = await build()
            const turn = client.runTurn(requestOf(), new AbortController().signal)
            const socket = sockets[0] as FakeSocket
            socket.reply = (request) =>
                request.method === "sessions.create"
                    ? { ok: false, error: { code: "EXISTS", message: "exists" } }
                    : { ok: true, payload: {} }

            socket.challenge()
            await flush()
            socket.assistant('{"reply":"ok"}')

            await expect(turn).resolves.toMatchObject({ text: '{"reply":"ok"}' })
        })

        it("refuses a turn whose signal is already aborted", async () => {
            const { client, sockets } = await build()
            const controller = new AbortController()
            controller.abort()

            await expect(client.runTurn(requestOf(), controller.signal)).rejects.toMatchObject({
                code: OpenclawErrorCode.GatewayAborted,
            })
            expect((sockets[0] as FakeSocket).closed).toBe(1)
        })

        it("stops when the caller aborts during the turn", async () => {
            const { client, sockets } = await build()
            const controller = new AbortController()
            const turn = client.runTurn(requestOf(), controller.signal)
            expect(sockets).toHaveLength(1)

            controller.abort()

            await expect(turn).rejects.toMatchObject({ code: OpenclawErrorCode.GatewayAborted })
        })

        it("fails at the deadline", async () => {
            jest.useFakeTimers()
            const { client } = await build()
            const turn = client.runTurn(requestOf({ timeoutMs: 5000 }), new AbortController().signal)
            const settled = turn.catch((error: unknown) => error)

            await jest.advanceTimersByTimeAsync(5000)

            await expect(settled).resolves.toMatchObject({
                code: OpenclawErrorCode.GatewayTimeout,
                params: { timeoutMs: 5000 },
            })
        })

        it("refuses a request the gateway refuses and names the method", async () => {
            const { client, sockets } = await build()
            const turn = client.runTurn(requestOf(), new AbortController().signal)
            const socket = sockets[0] as FakeSocket
            socket.reply = (request) => (request.method === "connect" ? { ok: false } : { ok: true, payload: {} })

            socket.challenge()

            await expect(turn).rejects.toMatchObject({
                code: OpenclawErrorCode.GatewayRefused,
                params: { method: "connect", gatewayCode: "error" },
            })
        })

        it("does not retry an unavailable gateway on a request other than connect", async () => {
            const { client, sockets } = await build()
            const turn = client.runTurn(requestOf(), new AbortController().signal)
            const socket = sockets[0] as FakeSocket
            socket.reply = (request) =>
                request.method === "sessions.subscribe"
                    ? { ok: false, error: { code: "UNAVAILABLE", message: "busy" } }
                    : { ok: true, payload: {} }

            socket.challenge()

            await expect(turn).rejects.toMatchObject({
                code: OpenclawErrorCode.GatewayRefused,
                params: { method: "sessions.subscribe", gatewayCode: "UNAVAILABLE" },
            })
            expect(sockets).toHaveLength(1)
        })

        it("retries the connect while the gateway starts, then succeeds", async () => {
            jest.useFakeTimers()
            const { client, sockets, logger } = await build()
            const turn = client.runTurn(requestOf(), new AbortController().signal)
            ;(sockets[0] as FakeSocket).reply = () => ({
                ok: false,
                error: { code: "UNAVAILABLE", message: "starting", details: { retryAfterMs: 50_000 } },
            })

            ;(sockets[0] as FakeSocket).challenge()
            await jest.advanceTimersByTimeAsync(10_000)
            const second = sockets[1] as FakeSocket
            second.challenge()
            await jest.advanceTimersByTimeAsync(0)
            second.assistant('{"reply":"ok"}')

            await expect(turn).resolves.toMatchObject({ text: '{"reply":"ok"}' })
            expect(logger.warn).toHaveBeenCalledTimes(1)
        })

        it("gives up after three connects that the gateway keeps deferring, waiting a second by default", async () => {
            jest.useFakeTimers()
            const { client, sockets } = await build()
            const turn = client.runTurn(requestOf(), new AbortController().signal)
            const settled = turn.catch((error: unknown) => error)
            const defer = (socket: FakeSocket) => {
                socket.reply = () => ({ ok: false, error: { code: "UNAVAILABLE", message: "starting" } })
                socket.challenge()
            }

            defer(sockets[0] as FakeSocket)
            await jest.advanceTimersByTimeAsync(1000)
            defer(sockets[1] as FakeSocket)
            await jest.advanceTimersByTimeAsync(1000)
            defer(sockets[2] as FakeSocket)

            await expect(settled).resolves.toMatchObject({
                code: OpenclawErrorCode.GatewayRefused,
                params: { method: "connect" },
            })
            expect(sockets).toHaveLength(3)
        })

        it("does not retry a deferred connect once the caller aborted", async () => {
            const { client, sockets } = await build()
            const controller = new AbortController()
            const turn = client.runTurn(requestOf(), controller.signal)
            const socket = sockets[0] as FakeSocket
            socket.reply = () => ({ ok: false, error: { code: "UNAVAILABLE", message: "starting" } })
            socket.onCloseHook = () => controller.abort()

            socket.challenge()

            await expect(turn).rejects.toMatchObject({ code: OpenclawErrorCode.GatewayRefused })
            expect(sockets).toHaveLength(1)
        })

        it("wraps a failure while sending in a socket failure", async () => {
            const { client, sockets } = await build()
            const turn = client.runTurn(requestOf(), new AbortController().signal)
            const socket = sockets[0] as FakeSocket
            socket.throwOnSend = true

            socket.challenge()

            await expect(turn).rejects.toMatchObject({ code: OpenclawErrorCode.GatewaySocketFailed })
        })

        it("fails when the socket errors", async () => {
            const { client, sockets } = await build()
            const turn = client.runTurn(requestOf(), new AbortController().signal)

            ;(sockets[0] as FakeSocket).fail("boom")

            await expect(turn).rejects.toMatchObject({
                code: OpenclawErrorCode.GatewaySocketFailed,
                params: { reason: "boom" },
            })
        })

        it("fails when the gateway closes before answering", async () => {
            const { client, sockets } = await build()
            const turn = client.runTurn(requestOf(), new AbortController().signal)

            ;(sockets[0] as FakeSocket).drop(1006)

            await expect(turn).rejects.toMatchObject({ code: OpenclawErrorCode.GatewayClosed })
        })

        it("fails when the run ends in error", async () => {
            const { client, sockets } = await build()
            const turn = client.runTurn(requestOf(), new AbortController().signal)
            const socket = sockets[0] as FakeSocket
            socket.challenge()
            await flush()

            socket.frame({ type: "event", event: "agent", payload: { status: "error" } })

            await expect(turn).rejects.toMatchObject({ code: OpenclawErrorCode.RunFailed })
        })

        it("answers the last candidate when the run reports a final status", async () => {
            const { client, sockets } = await build()
            const turn = client.runTurn(requestOf(), new AbortController().signal)
            const socket = sockets[0] as FakeSocket
            socket.challenge()
            await flush()

            socket.frame({ type: "event", event: "agent", payload: { status: "done" } })
            socket.frame({ type: "event", event: "agent", payload: { status: "streaming" } })
            socket.frame({ type: "event", event: "agent", payload: null })
            socket.frame({ type: "event", event: "agent", payload: { status: 3 } })
            socket.assistant("interim words")
            socket.frame({ type: "event", event: "agent", payload: { status: "completed" } })

            await expect(turn).resolves.toMatchObject({ text: "interim words" })
        })

        it("uses the last interim message after the settle delay and restarts the delay on a newer one", async () => {
            jest.useFakeTimers()
            const { client, sockets } = await build()
            const turn = client.runTurn(requestOf(), new AbortController().signal)
            const socket = sockets[0] as FakeSocket
            socket.challenge()
            await jest.advanceTimersByTimeAsync(0)

            socket.assistant("first")
            await jest.advanceTimersByTimeAsync(2000)
            socket.assistant("second")
            await jest.advanceTimersByTimeAsync(2999)
            const early = jest.getTimerCount()
            await jest.advanceTimersByTimeAsync(1)

            await expect(turn).resolves.toMatchObject({ text: "second" })
            expect(early).toBeGreaterThan(0)
        })

        it("lets the caller decide what is final", async () => {
            const { client, sockets } = await build()
            const turn = client.runTurn(
                requestOf({ isFinal: (text) => text.startsWith("FINAL") }),
                new AbortController().signal,
            )
            const socket = sockets[0] as FakeSocket
            socket.challenge()
            await flush()

            socket.assistant('{"reply":"not final for this caller"}', { stopReason: "stop" })
            socket.assistant("FINAL answer")

            await expect(turn).resolves.toMatchObject({ text: "FINAL answer" })
        })

        it("ignores everything that is not the agent's own words in its session", async () => {
            const { client, sockets } = await build()
            const turn = client.runTurn(requestOf(), new AbortController().signal)
            const socket = sockets[0] as FakeSocket
            socket.challenge()
            await flush()

            socket.raw("not json")
            socket.frame({ type: "res", id: "999", ok: true })
            socket.frame({ type: "event", event: "tick" })
            socket.assistant('{"reply":"other session"}', {}, "agent:other:session")
            socket.frame({
                type: "event",
                event: "session.message",
                payload: {
                    sessionKey: SESSION,
                    senderIsOwner: true,
                    message: { role: "assistant", content: '{"reply":"owner"}' },
                },
            })
            socket.frame({
                type: "event",
                event: "session.message",
                payload: { sessionKey: SESSION, message: { role: "user", content: '{"reply":"echo"}' } },
            })
            socket.frame({
                type: "event",
                event: "session.message",
                payload: { sessionKey: SESSION, message: { role: "system", content: '{"reply":"sys"}' } },
            })
            socket.frame({
                type: "event",
                event: "session.message",
                payload: { sessionKey: SESSION, message: { role: "assistant" } },
            })
            socket.assistant('{"reply":"real"}')
            socket.assistant('{"reply":"after the end"}')

            await expect(turn).resolves.toMatchObject({ text: '{"reply":"real"}' })
        })

        it("recreates the session after a failed turn", async () => {
            const { client, sockets } = await build()
            const failed = client.runTurn(requestOf(), new AbortController().signal)
            const first = sockets[0] as FakeSocket
            first.challenge()
            await flush()
            first.drop(1006)
            await expect(failed).rejects.toBeInstanceOf(OpenclawError)

            await answered(client, sockets)

            expect((sockets[1] as FakeSocket).sent.map((s) => s.method)).toContain("sessions.create")
        })
    })
})
