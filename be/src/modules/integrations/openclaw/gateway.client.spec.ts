import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { OpenclawErrorCode } from "./errors/openclaw.error"
import { GatewayClient } from "./gateway.client"
import type { GatewaySocket, GatewaySocketFactory } from "./gateway.client"
import type { TurnRequest } from "./openclaw.contracts"
import { OPENCLAW_OPTIONS, OPENCLAW_SOCKET_FACTORY } from "./openclaw.decorators"
import type { OpenclawOptions } from "./openclaw.options"

const THREAD = "agent:ws-1-chatbot:conv-1"

const SETTLE_MS = 60

const optionsOf = builder<OpenclawOptions>({
    gateway: { url: "ws://127.0.0.1:18789", auth: { kind: "token", token: new Secret("t") } },
    turnTimeoutMs: 90_000,
    settleMs: SETTLE_MS,
    configDir: undefined,
    gatewayStateDir: "/home/node/.openclaw",
    manageAgents: false,
    toolSecret: null,
})

const requestOf = builder<TurnRequest>({
    agentId: "ws-1-chatbot",
    threadKey: THREAD,
    message: "hello",
    idempotencyKey: "k-1",
    timeoutMs: 30_000,
})

interface Sent {
    readonly id: string
    readonly method: string
    readonly params: Record<string, unknown>
}

const isSent = (value: unknown): value is Sent =>
    typeof value === "object" && value !== null && "id" in value && "method" in value && "params" in value

const sentOf = (data: string): Sent => {
    try {
        const value: unknown = JSON.parse(data)
        return isSent(value) ? value : { id: "", method: "", params: {} }
    } catch (cause) {
        throw cause
    }
}

type Answer = Record<string, unknown> | null

class Gateway {
    readonly socket = mock<GatewaySocket>()
    readonly sent: Array<Sent> = []
    reply: (request: Sent) => Answer = () => ({ ok: true, payload: {} })
    failSend = false

    constructor() {
        this.socket.send.mockImplementation((data: string) => {
            if (this.failSend) new URL("not a url")
            const request = sentOf(data)
            this.sent.push(request)
            const answer = this.reply(request)
            if (answer !== null)
                void Promise.resolve().then(() => this.frame({ type: "res", id: request.id, ...answer }))
        })
    }

    methods(): Array<string> {
        return this.sent.map((request) => request.method)
    }

    frame(value: object): void {
        this.receiver()(JSON.stringify(value))
    }

    raw(text: string): void {
        this.receiver()(text)
    }

    challenge(): void {
        this.frame({ type: "event", event: "connect.challenge" })
    }

    assistant(content: unknown, extra: object = {}, thread = THREAD): void {
        this.frame({
            type: "event",
            event: "session.message",
            payload: { sessionKey: thread, message: { role: "assistant", content, ...extra } },
        })
    }

    event(event: string, payload: unknown): void {
        this.frame({ type: "event", event, payload })
    }

    fail(message: string): void {
        const call = this.socket.onError.mock.calls[0]
        if (call !== undefined) call[0](message)
    }

    drop(code: number): void {
        const call = this.socket.onClose.mock.calls[0]
        if (call !== undefined) call[0](code)
    }

    private receiver(): (data: string) => void {
        const call = this.socket.onMessage.mock.calls[0]
        return call === undefined ? () => undefined : call[0]
    }
}

const flush = async (): Promise<void> => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve()
}

const build = async (inputOptions: OpenclawOptions = optionsOf()) => {
    const options = builder<OpenclawOptions>(inputOptions)()
    const gateways: Array<Gateway> = []
    const logger = mock<Logger>()
    const sockets = mock<{ open: GatewaySocketFactory }>()
    sockets.open.mockImplementation(() => {
        const gateway = new Gateway()
        gateways.push(gateway)
        return gateway.socket
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GatewayClient,
            { provide: OPENCLAW_OPTIONS, useValue: options },
            { provide: OPENCLAW_SOCKET_FACTORY, useValue: sockets.open },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    const latest = (): Gateway => gateways[gateways.length - 1] ?? new Gateway()
    return { client: moduleRef.get(GatewayClient), gateways, latest, logger }
}

const started = async (
    client: GatewayClient,
    latest: () => Gateway,
    request = requestOf(),
    signal = new AbortController().signal,
) => {
    const turn = client.runTurn(request, signal)
    const gateway = latest()
    gateway.challenge()
    await flush()
    return { turn, gateway }
}

describe("GatewayClient turn outcomes", () => {
    it("is true with a gateway and false without", async () => {
        expect((await build()).client.enabled).toBe(true)
        expect((await build(optionsOf({ gateway: null }))).client.enabled).toBe(false)
    })

    it("refuses a turn when no gateway is configured", async () => {
        const { client } = await build(optionsOf({ gateway: null }))

        await expect(client.runTurn(requestOf(), new AbortController().signal)).rejects.toMatchObject({
            code: OpenclawErrorCode.GatewayNotConfigured,
        })
    })

    it("walks the protocol and answers the final contract reply with the summed usage", async () => {
        const { client, latest } = await build()
        const { turn, gateway } = await started(client, latest)

        gateway.assistant("thinking", {
            stopReason: "toolUse",
            usage: { input: 3, output: 1, cacheRead: 0, cacheWrite: 0, cost: { total: 0.1 } },
        })
        gateway.assistant('{"reply":"Hi!"}', {
            stopReason: "stop",
            provider: "p",
            model: "m",
            usage: { input: 5, output: 2, cacheRead: 4, cacheWrite: 1, cost: { total: 0.2 } },
        })
        const result = await turn

        expect(gateway.methods()).toEqual([
            "connect",
            "sessions.create",
            "sessions.subscribe",
            "sessions.messages.subscribe",
            "sessions.send",
        ])
        expect(gateway.sent[0]?.params).toMatchObject({ auth: { token: "t" }, role: "operator" })
        expect(gateway.sent[4]?.params).toMatchObject({
            key: THREAD,
            message: "hello",
            idempotencyKey: "k-1",
            timeoutMs: 30_000,
        })
        expect(result.text).toBe('{"reply":"Hi!"}')
        const { cost, ...usage } = { ...result.usage }
        expect(usage).toEqual({ prompt_tokens: 13, completion_tokens: 3, cached_tokens: 4, model: "p/m" })
        expect(cost).toBeCloseTo(0.3, 5)
        expect(Object.keys(result.timings)).toEqual(["connect", "create", "subscribe", "send_ack", "reply", "total"])
        expect(gateway.socket.close).toHaveBeenCalledTimes(1)

        gateway.drop(1000)
        expect(gateway.socket.close).toHaveBeenCalledTimes(1)
    })
})

describe("GatewayClient turn outcomes", () => {
    it("answers no usage when the gateway reported none and reuses a created session", async () => {
        const { client, latest, gateways } = await build()
        const first = await started(client, latest)
        first.gateway.assistant('{"reply":"hi"}')
        const second = await started(client, latest)
        second.gateway.assistant('{"reply":"again"}')

        expect((await first.turn).usage).toBeNull()
        expect((await second.turn).text).toBe('{"reply":"again"}')
        expect(gateways[1]?.methods()).not.toContain("sessions.create")
    })

    it("goes on when the session already exists", async () => {
        const { client, latest } = await build()
        const turn = client.runTurn(requestOf(), new AbortController().signal)
        const gateway = latest()
        gateway.reply = (request) =>
            request.method === "sessions.create"
                ? { ok: false, error: { code: "EXISTS", message: "exists" } }
                : { ok: true, payload: {} }
        gateway.challenge()
        await flush()

        gateway.assistant('{"reply":"ok"}')

        await expect(turn).resolves.toMatchObject({ text: '{"reply":"ok"}' })
    })

    it("refuses a turn whose signal is already aborted", async () => {
        const { client, latest } = await build()
        const controller = new AbortController()
        controller.abort()

        await expect(client.runTurn(requestOf(), controller.signal)).rejects.toMatchObject({
            code: OpenclawErrorCode.GatewayAborted,
        })
        expect(latest().socket.close).toHaveBeenCalledTimes(1)
    })

    it("stops when the caller aborts during the turn", async () => {
        const { client } = await build()
        const controller = new AbortController()
        const turn = client.runTurn(requestOf(), controller.signal)

        controller.abort()

        await expect(turn).rejects.toMatchObject({ code: OpenclawErrorCode.GatewayAborted })
    })

    it("fails at the deadline", async () => {
        const { client } = await build()

        await expect(client.runTurn(requestOf({ timeoutMs: 20 }), new AbortController().signal)).rejects.toMatchObject({
            code: OpenclawErrorCode.GatewayTimeout,
            params: { timeoutMs: 20 },
        })
    })
})

describe("GatewayClient turn outcomes", () => {
    it("refuses a request the gateway refuses and names the method", async () => {
        const { client, latest } = await build()
        const turn = client.runTurn(requestOf(), new AbortController().signal)
        const gateway = latest()
        gateway.reply = (request) => (request.method === "connect" ? { ok: false } : { ok: true, payload: {} })

        gateway.challenge()

        await expect(turn).rejects.toMatchObject({
            code: OpenclawErrorCode.GatewayRefused,
            params: { method: "connect", gatewayCode: "error" },
        })
    })

    it("does not retry an unavailable gateway on a request other than connect", async () => {
        const { client, latest, gateways } = await build()
        const turn = client.runTurn(requestOf(), new AbortController().signal)
        const gateway = latest()
        gateway.reply = (request) =>
            request.method === "sessions.subscribe"
                ? { ok: false, error: { code: "UNAVAILABLE", message: "busy" } }
                : { ok: true, payload: {} }

        gateway.challenge()

        await expect(turn).rejects.toMatchObject({
            code: OpenclawErrorCode.GatewayRefused,
            params: { method: "sessions.subscribe", gatewayCode: "UNAVAILABLE" },
        })
        expect(gateways).toHaveLength(1)
    })

    it("retries the connect while the gateway starts, then succeeds", async () => {
        const { client, latest, gateways, logger } = await build()
        const turn = client.runTurn(requestOf(), new AbortController().signal)
        const first = latest()
        first.reply = () => ({
            ok: false,
            error: { code: "UNAVAILABLE", message: "starting", details: { retryAfterMs: 5 } },
        })
        first.challenge()
        await new Promise((resolve) => AbortSignal.timeout(40).addEventListener("abort", resolve, { once: true }))
        const second = latest()
        second.challenge()
        await flush()

        second.assistant('{"reply":"ok"}')

        await expect(turn).resolves.toMatchObject({ text: '{"reply":"ok"}' })
        expect(gateways).toHaveLength(2)
        expect(logger.warn).toHaveBeenCalledTimes(1)
    })
})

describe("GatewayClient turn outcomes", () => {
    it("gives up after three connects that the gateway keeps deferring", async () => {
        const { client, latest, gateways } = await build()
        const turn = client.runTurn(requestOf(), new AbortController().signal)
        const settled = turn.catch((error: unknown) => error)
        const defer = async (index: number): Promise<void> => {
            const gateway = latest()
            gateway.reply = () => ({
                ok: false,
                error: { code: "UNAVAILABLE", message: "starting", details: { retryAfterMs: 5 } },
            })
            gateway.challenge()
            if (index < 2)
                await new Promise((resolve) =>
                    AbortSignal.timeout(40).addEventListener("abort", resolve, { once: true }),
                )
        }

        await defer(0)
        await defer(1)
        await defer(2)

        await expect(settled).resolves.toMatchObject({
            code: OpenclawErrorCode.GatewayRefused,
            params: { method: "connect" },
        })
        expect(gateways).toHaveLength(3)
    })

    it("does not retry a deferred connect once the caller aborted", async () => {
        const { client, latest, gateways } = await build()
        const controller = new AbortController()
        const turn = client.runTurn(requestOf(), controller.signal)
        const gateway = latest()
        gateway.reply = () => ({ ok: false, error: { code: "UNAVAILABLE", message: "starting" } })
        gateway.socket.close.mockImplementation(() => controller.abort())

        gateway.challenge()

        await expect(turn).rejects.toMatchObject({ code: OpenclawErrorCode.GatewayRefused })
        expect(gateways).toHaveLength(1)
    })

    it("wraps a failure while sending in a socket failure", async () => {
        const { client, latest } = await build()
        const turn = client.runTurn(requestOf(), new AbortController().signal)
        const gateway = latest()
        gateway.failSend = true

        gateway.challenge()

        await expect(turn).rejects.toMatchObject({ code: OpenclawErrorCode.GatewaySocketFailed })
    })

    it("fails when the socket errors", async () => {
        const { client, latest } = await build()
        const turn = client.runTurn(requestOf(), new AbortController().signal)

        latest().fail("boom")

        await expect(turn).rejects.toMatchObject({
            code: OpenclawErrorCode.GatewaySocketFailed,
            params: { reason: "boom" },
        })
    })
})

describe("GatewayClient turn outcomes", () => {
    it("fails when the gateway closes before answering", async () => {
        const { client, latest } = await build()
        const turn = client.runTurn(requestOf(), new AbortController().signal)

        latest().drop(1006)

        await expect(turn).rejects.toMatchObject({ code: OpenclawErrorCode.GatewayClosed })
    })

    it("fails when the run ends in error", async () => {
        const { client, latest } = await build()
        const { turn, gateway } = await started(client, latest)

        gateway.event("agent", { status: "error" })

        await expect(turn).rejects.toMatchObject({ code: OpenclawErrorCode.RunFailed })
    })

    it("answers the last candidate when the run reports a final status", async () => {
        const { client, latest } = await build()
        const { turn, gateway } = await started(client, latest)

        gateway.event("agent", { status: "done" })
        gateway.event("agent", { status: "streaming" })
        gateway.event("agent", null)
        gateway.event("agent", { status: 3 })
        gateway.assistant("interim words")
        gateway.event("agent", { status: "completed" })

        await expect(turn).resolves.toMatchObject({ text: "interim words" })
    })

    it("uses the last interim text after the settle delay and restarts the delay on a newer one", async () => {
        const { client, latest } = await build()
        const { turn, gateway } = await started(client, latest)

        // Both interim texts arrive in one synchronous run, so no settle timer can fire between them whatever the
        // The first text's timer is armed, then superseded; only the second text may settle the turn.
        gateway.assistant("first")
        gateway.assistant("second")

        await expect(turn).resolves.toMatchObject({ text: "second" })
    })

    it("lets the caller decide what is final", async () => {
        const { client, latest } = await build()
        const { turn, gateway } = await started(
            client,
            latest,
            requestOf({ isFinal: (text) => text.startsWith("FINAL") }),
        )

        gateway.assistant('{"reply":"not final for this caller"}', { stopReason: "stop" })
        gateway.assistant("FINAL answer")

        await expect(turn).resolves.toMatchObject({ text: "FINAL answer" })
    })
})

describe("GatewayClient turn outcomes", () => {
    it("ignores everything that is not the agent's own words in its thread", async () => {
        const { client, latest, logger } = await build()
        const { turn, gateway } = await started(client, latest)

        gateway.raw("not json")
        gateway.frame({ type: "res", id: "999", ok: true })
        gateway.event("tick", null)
        gateway.assistant('{"reply":"other thread"}', {}, "agent:other:thread")
        gateway.event("session.message", {
            sessionKey: THREAD,
            senderIsOwner: true,
            message: { role: "assistant", content: '{"reply":"owner"}' },
        })
        gateway.event("session.message", {
            sessionKey: THREAD,
            message: { role: "user", content: '{"reply":"echo"}' },
        })
        gateway.event("session.message", {
            sessionKey: THREAD,
            message: { role: "system", content: '{"reply":"sys"}' },
        })
        gateway.event("session.message", { sessionKey: THREAD, message: { role: "assistant" } })
        gateway.assistant('{"reply":"real"}')
        gateway.assistant('{"reply":"after the end"}')

        await expect(turn).resolves.toMatchObject({ text: '{"reply":"real"}' })
        expect(logger.error).toHaveBeenCalledTimes(1)
    })

    it("recreates the session after a failed turn", async () => {
        const { client, latest, gateways } = await build()
        const failed = await started(client, latest)
        failed.gateway.drop(1006)
        await expect(failed.turn).rejects.toMatchObject({ code: OpenclawErrorCode.GatewayClosed })

        const next = await started(client, latest)
        next.gateway.assistant('{"reply":"ok"}')
        await next.turn

        expect(gateways[1]?.methods()).toContain("sessions.create")
    })
})
