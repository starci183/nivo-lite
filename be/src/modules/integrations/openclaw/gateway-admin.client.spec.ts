import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { OpenclawErrorCode } from "./errors/openclaw.error"
import { GatewayAdminClient } from "./gateway-admin.client"
import type { GatewaySocket, GatewaySocketFactory } from "./gateway.client"
import { OPENCLAW_OPTIONS, OPENCLAW_SOCKET_FACTORY } from "./openclaw.decorators"
import { OpenclawLogEvent } from "./openclaw.log-events"
import type { OpenclawOptions } from "./openclaw.options"

const WORKSPACE = "12345678-aaaa-bbbb-cccc-000000000000"
const SALES = "ws-12345678aaaabbbb-sales"
const NIVO = "ws-12345678aaaabbbb-nivo"

const optionsOf = builder<OpenclawOptions>({
    gateway: { url: "ws://127.0.0.1:18789", auth: { kind: "token", token: new Secret("t") } },
    turnTimeoutMs: 90_000,
    settleMs: 60,
    configDir: undefined,
    gatewayStateDir: "/home/node/.openclaw",
    manageAgents: false,
    toolSecret: null,
})

interface Sent {
    readonly id: string
    readonly method: string
    readonly params: Record<string, unknown>
}

const isSent = (value: unknown): value is Sent =>
    typeof value === "object" && value !== null && "id" in value && "method" in value && "params" in value

const sentOf = (data: string): Sent | null => {
    try {
        const value: unknown = JSON.parse(data)
        return isSent(value) ? value : null
    } catch (cause) {
        throw cause
    }
}

/** A scripted gateway: it speaks first, then answers each request by its method. */
const gatewayOf = (answers: Record<string, object>) => {
    const socket = mock<GatewaySocket>()
    const sent: Array<Sent> = []
    let receiver: (data: string) => void = () => undefined
    socket.onMessage.mockImplementation((next: (data: string) => void) => {
        receiver = next
    })
    socket.send.mockImplementation((data: string) => {
        const request = sentOf(data)
        if (request === null) return
        sent.push(request)
        const answer = answers[request.method] ?? { ok: true, payload: {} }
        void Promise.resolve().then(() => receiver(JSON.stringify({ type: "res", id: request.id, ...answer })))
    })
    return {
        socket,
        sent,
        receive: (text: string) => receiver(text),
        challenge: () => receiver(JSON.stringify({ type: "event", event: "connect.challenge" })),
    }
}

const build = async (socket: GatewaySocket, inputOptions: OpenclawOptions = optionsOf()) => {
    const options = builder<OpenclawOptions>(inputOptions)()
    const sockets = mock<{ open: GatewaySocketFactory }>()
    sockets.open.mockReturnValue(socket)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            GatewayAdminClient,
            { provide: OPENCLAW_OPTIONS, useValue: options },
            { provide: OPENCLAW_SOCKET_FACTORY, useValue: sockets.open },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client: moduleRef.get(GatewayAdminClient), logger }
}

const registerWorkspaceRemovalCases = () => {
    it("connects as admin and deletes only the agents of the workspace, files included", async () => {
        const agents = [{ id: "main" }, { id: SALES }, { id: NIVO }, { id: "ws-ffffffffffffffff-sales" }]
        const gateway = gatewayOf({ "agents.list": { ok: true, payload: { agents } } })
        const { client } = await build(gateway.socket)

        const removal = client.removeWorkspaceAgents(WORKSPACE)
        gateway.challenge()

        await expect(removal).resolves.toEqual([SALES, NIVO])
        expect(gateway.sent.map((request) => request.method)).toEqual([
            "connect",
            "agents.list",
            "agents.delete",
            "agents.delete",
            "nivo.purgeAgents",
        ])
        expect(gateway.sent[4]?.params).toEqual({ match: "ws-12345678aaaabbbb-" })
        expect(gateway.sent[0]?.params.scopes).toContain("operator.admin")
        expect(gateway.sent[2]?.params).toEqual({ agentId: SALES, deleteFiles: true })
        expect(gateway.socket.close).toHaveBeenCalledTimes(1)
    })

    it("answers nothing when the workspace has no agent", async () => {
        const gateway = gatewayOf({ "agents.list": { ok: true, payload: { agents: [{ id: "main" }] } } })
        const { client } = await build(gateway.socket)

        const removal = client.removeWorkspaceAgents(WORKSPACE)
        gateway.challenge()

        await expect(removal).resolves.toEqual([])
    })

    it("refuses when the gateway refuses a delete", async () => {
        const gateway = gatewayOf({
            "agents.list": { ok: true, payload: { agents: [{ id: SALES }] } },
            "agents.delete": { ok: false, error: { code: "INVALID_REQUEST", message: "missing scope" } },
        })
        const { client } = await build(gateway.socket)

        const removal = client.removeWorkspaceAgents(WORKSPACE)
        gateway.challenge()

        await expect(removal).rejects.toMatchObject({ code: OpenclawErrorCode.GatewayRefused })
    })

    it("refuses when no gateway is configured", async () => {
        const { client } = await build(mock<GatewaySocket>(), optionsOf({ gateway: null }))

        expect(client.enabled).toBe(false)
        await expect(client.removeWorkspaceAgents(WORKSPACE)).rejects.toMatchObject({
            code: OpenclawErrorCode.GatewayNotConfigured,
        })
    })
}

describe("GatewayAdminClient", () => {
    registerWorkspaceRemovalCases()

    it("removes exactly the named agent and ignores malformed entries beside other agents", async () => {
        const gateway = gatewayOf({
            "agents.list": { ok: true, payload: { agents: [null, 1, {}, { id: 42 }, { id: NIVO }, { id: SALES }] } },
        })
        const { client } = await build(gateway.socket)
        const removal = client.removeAgent(SALES)
        gateway.challenge()
        await expect(removal).resolves.toEqual([SALES])
        expect(
            gateway.sent.filter((request) => request.method === "agents.delete").map((request) => request.params),
        ).toEqual([{ agentId: SALES, deleteFiles: true }])
        expect(gateway.sent.at(-1)?.params).toEqual({ match: SALES })
    })

    it.each([null, {}, { agents: null }])(
        "treats a malformed agent-list payload as no registered agents: %p",
        async (payload) => {
            const gateway = gatewayOf({ "agents.list": { ok: true, payload } })
            const { client } = await build(gateway.socket)
            const removal = client.removeWorkspaceAgents(WORKSPACE)
            gateway.challenge()
            await expect(removal).resolves.toEqual([])
            expect(gateway.sent.map((request) => request.method)).toEqual([
                "connect",
                "agents.list",
                "nivo.purgeAgents",
            ])
        },
    )

    it("logs malformed JSON, ignores unknown frames and continues the removal on a valid challenge", async () => {
        const gateway = gatewayOf({})
        const { client, logger } = await build(gateway.socket)
        const removal = client.removeAgent(SALES)
        gateway.receive("{")
        gateway.receive('{"type":"unknown"}')
        gateway.challenge()
        await expect(removal).resolves.toEqual([])
        expect(logger.error.mock.calls[0]?.[0]).toBe(OpenclawLogEvent.FrameRejected)
        expect(logger.error.mock.calls[0]?.[1]).toBeInstanceOf(SyntaxError)
        expect(gateway.socket.close).toHaveBeenCalledTimes(1)
    })

    it("refuses an unanswered removal at its deadline and settles only once when the socket later closes", async () => {
        const timeout = new AbortController()
        const deadline = jest.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal)
        try {
            const gateway = gatewayOf({})
            const { client } = await build(gateway.socket)
            const removal = client.removeAgent(SALES)
            const rejected = expect(removal).rejects.toMatchObject({
                code: OpenclawErrorCode.GatewayTimeout,
                params: { timeoutMs: 60_000 },
            })
            timeout.abort()
            await rejected
            gateway.socket.onClose.mock.calls[0]?.[0](1000)
            expect(deadline).toHaveBeenCalledWith(60_000)
            expect(gateway.socket.close).toHaveBeenCalledTimes(1)
        } finally {
            deadline.mockRestore()
        }
    })
})
