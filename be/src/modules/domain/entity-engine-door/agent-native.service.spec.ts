import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { agentIdFor, OPENCLAW_GATEWAY, OPENCLAW_GATEWAY_HISTORY, threadKeyFor } from "@modules/integrations/openclaw"
import type { GatewayClient, GatewayHistoryClient } from "@modules/integrations/openclaw"
import { AGENT_MANIFEST, AgentNativeService } from "./agent-native.service"

const CALLER = { agentId: "agent-1", conversationId: null }
const AGENT = agentIdFor("ws-1", "nivo")
const THREAD = threadKeyFor(AGENT, "session-1")
const TURN = { agentKey: "nivo", sessionKey: "session-1", message: "hello", idempotencyKey: "k-1" }

const build = async () => {
    const gateway = mock<GatewayClient>()
    gateway.runTurn.mockResolvedValue({ text: "xong", usage: null, timings: {} })
    const history = mock<GatewayHistoryClient>()
    history.read.mockResolvedValue([
        {
            index: 0,
            role: "user",
            text: "hi",
            toolCalls: [{ name: "ledger.append", argsJson: "{}" }],
            at: "2026-11-05T00:00:00.000Z",
        },
    ])
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentNativeService,
            { provide: OPENCLAW_GATEWAY, useValue: gateway },
            { provide: OPENCLAW_GATEWAY_HISTORY, useValue: history },
        ],
    }).compile()
    return { service: moduleRef.get(AgentNativeService), gateway, history }
}

describe("AgentNativeService", () => {
    it("announces a write tool that takes its replay key and a read tool, both internal", () => {
        expect(AGENT_MANIFEST.tools.map((tool) => [tool.name, tool.scope, tool.internalOnly])).toEqual([
            ["turn", "write", true],
            ["history", "read", true],
        ])
        expect(AGENT_MANIFEST.tools[0]?.idempotencyArg).toBe("idempotencyKey")
    })

    it("runs a turn on the workspace agent and thread and answers the final text", async () => {
        const { service, gateway } = await build()
        expect(await service.invoke("ws-1", "turn", TURN, CALLER)).toEqual({ text: "xong" })
        expect(gateway.runTurn).toHaveBeenCalledWith(
            { agentId: AGENT, threadKey: THREAD, message: "hello", idempotencyKey: "k-1", timeoutMs: 120_000 },
            expect.any(AbortSignal),
        )
    })

    it("takes the deadline the caller gives", async () => {
        const { service, gateway } = await build()
        await service.invoke("ws-1", "turn", { ...TURN, timeoutMs: 5000 }, CALLER)
        expect(gateway.runTurn).toHaveBeenCalledWith(
            expect.objectContaining({ timeoutMs: 5000 }),
            expect.any(AbortSignal),
        )
    })

    it("refuses a turn whose arguments do not fit or that carries no replay key", async () => {
        const { service, gateway } = await build()
        const { idempotencyKey: _key, ...withoutKey } = TURN
        for (const args of [{ ...TURN, agentKey: "Nivo" }, withoutKey]) {
            await expect(service.invoke("ws-1", "turn", args, CALLER)).rejects.toMatchObject({
                code: McpGatewayErrorCode.InvalidArguments,
            })
        }
        expect(gateway.runTurn).not.toHaveBeenCalled()
    })

    it("reads the turns of a session as JSON", async () => {
        const { service, history } = await build()
        const answer = await service.invoke("ws-1", "history", { agentKey: "nivo", sessionKey: "session-1" }, CALLER)
        expect(answer).toEqual({
            turns: [
                {
                    index: 0,
                    role: "user",
                    text: "hi",
                    toolCalls: [{ name: "ledger.append", argsJson: "{}" }],
                    at: "2026-11-05T00:00:00.000Z",
                },
            ],
        })
        expect(history.read).toHaveBeenCalledWith({ threadKey: THREAD, timeoutMs: 30_000 }, expect.any(AbortSignal))
    })

    it("refuses history arguments that do not fit, and a tool it does not have", async () => {
        const { service } = await build()
        await expect(service.invoke("ws-1", "history", { agentKey: "nivo" }, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
        })
        await expect(service.invoke("ws-1", "fly", {}, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
        })
    })
})
