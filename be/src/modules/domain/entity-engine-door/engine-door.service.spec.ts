import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { McpGatewayService, argsHashOf } from "@modules/domain/mcp-gateway"
import type { GatewayCallResult, WorkspaceConnector } from "@modules/domain/mcp-gateway"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { DoorTool } from "@nivo-lite/agent-sdk/mutation"
import type { DoorBinding } from "./entity-engine-door.contracts"
import { EngineDoorService } from "./engine-door.service"
import { EntityEngineDoorErrorCode } from "./errors/entity-engine-door.error"

const NIVO_ID = "0b6e1c52-0000-4000-8000-000000000001"

const binding = (scopeOpen = false): DoorBinding => ({
    workspaceId: "ws-1",
    effectKey: (step) => `job-1:${step}`,
    scopeOpen: () => scopeOpen,
})

const build = async (
    result: GatewayCallResult = { ok: true, value: { sent: true } },
    connectors: ReadonlyArray<WorkspaceConnector> = [],
    nivoIds: Array<string> = [NIVO_ID],
) => {
    const gateway = mock<McpGatewayService>()
    gateway.call.mockResolvedValue(result)
    gateway.connectorsOf.mockResolvedValue(connectors)
    const agents = mock<AgentDirectoryService>()
    agents.idsOfModule.mockResolvedValue(nivoIds)
    const moduleRef = await Test.createTestingModule({
        providers: [
            EngineDoorService,
            { provide: McpGatewayService, useValue: gateway },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return { door: moduleRef.get(EngineDoorService), gateway }
}

/** Arguments nested past what the gateway reads. */
const deepArgs = (): Record<string, JsonValue> => {
    let value: Record<string, JsonValue> = {}
    for (let i = 0; i < 40; i += 1) value = { value }
    return value
}

describe("EngineDoorService", () => {
    it("calls the gateway as the workspace agent, internal, under the job's replay key", async () => {
        const { door, gateway } = await build()
        const result = await door.doorApi(binding()).call("ai.agent.turn", { to: "a" })
        expect(result).toEqual({ ok: true, output: { sent: true } })
        expect(gateway.call).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                agentId: NIVO_ID,
                conversationId: null,
                workItemId: null,
                audience: "internal",
                engine: true,
                opKey: `job-1:ai.agent.turn:${argsHashOf({ to: "a" })}`,
            },
            "agent.turn",
            { to: "a" },
        )
    })

    it("calls the gateway as the seeded nivo agent of the workspace, and refuses when the workspace has none", async () => {
        const { door, gateway } = await build(undefined, [], [])
        await expect(door.doorApi(binding()).call("ai.agent.turn", {})).rejects.toMatchObject({
            code: EntityEngineDoorErrorCode.NoAgent,
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("maps a gateway refusal to a door failure", async () => {
        const { door } = await build({ ok: false, code: "not_granted", detail: "agent.turn" })
        expect(await door.doorApi(binding()).call("ai.agent.turn", {})).toEqual({
            ok: false,
            reason: "forbidden",
            message: "agent.turn",
        })
    })

    it("refuses a call while an engine scope is open, and never reaches the gateway", async () => {
        const { door, gateway } = await build()
        await expect(door.doorApi(binding(true)).call("ai.agent.turn", {})).rejects.toMatchObject({
            code: EntityEngineDoorErrorCode.InScope,
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("answers forbidden for a tool the internal agent does not hold, and never reaches the gateway", async () => {
        const { door, gateway } = await build()
        const denied: ReadonlyArray<DoorTool> = ["chat.zalo.send", "ai.agent.delete", "Chat.zalo.send"]
        for (const tool of denied) {
            expect(await door.doorApi(binding()).call(tool, {})).toEqual({
                ok: false,
                reason: "forbidden",
                message: "not_granted",
            })
        }
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("answers invalid for arguments the gateway cannot take", async () => {
        const { door, gateway } = await build()
        const result = await door.doorApi(binding()).call("ai.agent.turn", { nested: deepArgs() })
        expect(result).toEqual({ ok: false, reason: "invalid", message: "invalid_arguments" })
        expect(gateway.call).not.toHaveBeenCalled()
    })
})

/** A connector of the workspace whose tool `send` plays the domain tool `chat.send`. */
const CHANNEL = builder<WorkspaceConnector>({
    manifest: {
        key: "zalo",
        name: "Zalo",
        kind: "native",
        contractVersion: "zalo@1",
        tools: [
            {
                name: "send",
                description: "Send",
                scope: "write",
                defaultMode: "auto",
                inputSchema: {},
                domain: "chat.send",
            },
        ],
    },
    status: "active",
    url: null,
    credentialState: "none",
    credentialSetAt: null,
    timeoutMs: 4000,
    approvedTools: null,
    approvedAt: null,
    checkedAt: null,
})()

describe("EngineDoorService domain tools", () => {
    it("resolves a domain tool to the tool of the workspace's own connection that plays it", async () => {
        const { door, gateway } = await build({ ok: true, value: { sent: true } }, [CHANNEL])
        const result = await door.doorApi(binding()).call("chat.send", { key: "m1" })
        expect(result).toEqual({ ok: true, output: { sent: true } })
        expect(gateway.connectorsOf).toHaveBeenCalledWith("ws-1")
        expect(gateway.call).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: "ws-1", opKey: `job-1:chat.send:${argsHashOf({ key: "m1" })}` }),
            "zalo.send",
            { key: "m1" },
        )
    })

    it("answers unknown_tool for a domain tool no connection of the workspace plays, and calls nothing", async () => {
        const { door, gateway } = await build()
        expect(await door.doorApi(binding()).call("chat.send", {})).toEqual({
            ok: false,
            reason: "unknown_tool",
            message: "no_provider",
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("does not look a provider up for a tool that names one", async () => {
        const { door, gateway } = await build()
        await door.doorApi(binding()).call("ai.agent.turn", {})
        expect(gateway.connectorsOf).not.toHaveBeenCalled()
    })
})
