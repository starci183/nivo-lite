import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { OpenclawErrorCode } from "./errors/openclaw.error"
import { GatewayHistoryClient } from "./gateway-history.client"
import type { GatewaySocket, GatewaySocketFactory } from "./gateway.client"
import type { HistoryRequest } from "./openclaw.contracts"
import { OPENCLAW_OPTIONS, OPENCLAW_SOCKET_FACTORY } from "./openclaw.decorators"
import type { OpenclawOptions } from "./openclaw.options"

const THREAD = "agent:ws-1-nivo:session-1"

const optionsOf = builder<OpenclawOptions>({
    gateway: { url: "ws://127.0.0.1:18789", auth: { kind: "token", token: new Secret("t") } },
    turnTimeoutMs: 90_000,
    settleMs: 60,
    configDir: undefined,
    gatewayStateDir: "/home/node/.openclaw",
    manageAgents: false,
    toolSecret: null,
})

const requestOf = builder<HistoryRequest>({ threadKey: THREAD, timeoutMs: 30_000 })

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

type Answer = Record<string, unknown>

class Gateway {
    readonly socket = mock<GatewaySocket>()
    readonly sent: Array<Sent> = []
    reply: (request: Sent) => Answer = (request) =>
        request.method === "connect"
            ? { ok: true, payload: {} }
            : { ok: true, payload: { messages: [{ role: "user", content: "hi" }] } }

    constructor() {
        this.socket.send.mockImplementation((data: string) => {
            const request = sentOf(data)
            this.sent.push(request)
            const answer = this.reply(request)
            void Promise.resolve().then(() => this.frame({ type: "res", id: request.id, ...answer }))
        })
    }

    frame(value: object): void {
        this.raw(JSON.stringify(value))
    }

    raw(text: string): void {
        const call = this.socket.onMessage.mock.calls[0]
        if (call !== undefined) call[0](text)
    }

    challenge(): void {
        this.frame({ type: "event", event: "connect.challenge" })
    }

    fail(message: string): void {
        const call = this.socket.onError.mock.calls[0]
        if (call !== undefined) call[0](message)
    }

    drop(code: number): void {
        const call = this.socket.onClose.mock.calls[0]
        if (call !== undefined) call[0](code)
    }
}

const build = async (inputOptions: OpenclawOptions = optionsOf()) => {
    const options = builder<OpenclawOptions>(inputOptions)()
    const gateway = new Gateway()
    const sockets = mock<{ open: GatewaySocketFactory }>()
    sockets.open.mockImplementation(() => gateway.socket)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GatewayHistoryClient,
            { provide: OPENCLAW_OPTIONS, useValue: options },
            { provide: OPENCLAW_SOCKET_FACTORY, useValue: sockets.open },
            { provide: CLOCK, useValue: new FakeClock("2026-11-05T00:00:00.000Z") },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return { client: moduleRef.get(GatewayHistoryClient), gateway }
}

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

describe("GatewayHistoryClient", () => {
    it("is enabled with a gateway and refuses a read without one", async () => {
        const { client } = await build()
        expect(client.enabled).toBe(true)
        const off = await build(optionsOf({ gateway: null }))
        expect(off.client.enabled).toBe(false)
        await expect(off.client.read(requestOf(), new AbortController().signal)).rejects.toMatchObject({
            code: OpenclawErrorCode.GatewayNotConfigured,
        })
    })

    it("connects, asks for the thread history and answers its turns", async () => {
        const { client, gateway } = await build()
        const read = client.read(requestOf(), new AbortController().signal)
        gateway.challenge()
        await expect(read).resolves.toEqual([
            { index: 0, role: "user", text: "hi", toolCalls: [], at: "2026-11-05T00:00:00.000Z" },
        ])
        expect(gateway.sent.map((sent) => sent.method)).toEqual(["connect", "chat.history"])
        expect(gateway.sent[1]?.params).toEqual({ sessionKey: THREAD, limit: 1000 })
        expect(gateway.socket.close).toHaveBeenCalled()
    })

    it("names the method the gateway refuses", async () => {
        const { client, gateway } = await build()
        gateway.reply = (request) =>
            request.method === "connect"
                ? { ok: true, payload: {} }
                : { ok: false, error: { code: "INVALID_REQUEST", message: "no" } }
        const read = client.read(requestOf(), new AbortController().signal)
        gateway.challenge()
        await expect(read).rejects.toMatchObject({ code: OpenclawErrorCode.GatewayRefused })
    })

    it("ignores frames it cannot read and events other than the challenge", async () => {
        const { client, gateway } = await build()
        const read = client.read(requestOf(), new AbortController().signal)
        gateway.raw("not json")
        gateway.frame({ type: "event", event: "tick" })
        gateway.challenge()
        await expect(read).resolves.toHaveLength(1)
    })

    it("fails when the socket errors or closes before the answer", async () => {
        const first = await build()
        const errored = first.client.read(requestOf(), new AbortController().signal)
        first.gateway.fail("boom")
        await expect(errored).rejects.toMatchObject({ code: OpenclawErrorCode.GatewaySocketFailed })
        const second = await build()
        const closed = second.client.read(requestOf(), new AbortController().signal)
        second.gateway.drop(1006)
        await expect(closed).rejects.toMatchObject({ code: OpenclawErrorCode.GatewayClosed })
    })
})

describe("GatewayHistoryClient stops", () => {
    it("stops when the caller aborts, before or during the read", async () => {
        const before = await build()
        const aborted = new AbortController()
        aborted.abort()
        await expect(before.client.read(requestOf(), aborted.signal)).rejects.toMatchObject({
            code: OpenclawErrorCode.GatewayAborted,
        })
        const during = await build()
        const controller = new AbortController()
        const read = during.client.read(requestOf(), controller.signal)
        await settle()
        controller.abort()
        await expect(read).rejects.toMatchObject({ code: OpenclawErrorCode.GatewayAborted })
    })

    it("fails at the deadline", async () => {
        const { client } = await build()
        await expect(client.read(requestOf({ timeoutMs: 5 }), new AbortController().signal)).rejects.toMatchObject({
            code: OpenclawErrorCode.GatewayTimeout,
        })
    })

    it("settles once: a late socket event after the answer changes nothing", async () => {
        const { client, gateway } = await build()
        const read = client.read(requestOf(), new AbortController().signal)
        gateway.challenge()
        await read
        gateway.drop(1000)
        gateway.fail("late")
        expect(gateway.socket.close).toHaveBeenCalledTimes(1)
    })
})
