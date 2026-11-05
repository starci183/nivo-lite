import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { McpGatewayService, argsHashOf } from "@modules/domain/mcp-gateway"
import type { GatewayCallResult } from "@modules/domain/mcp-gateway"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { agentIdFor } from "@modules/integrations/openclaw"
import { ENTITY_ENGINE_DOOR_OPTIONS } from "./entity-engine-door.decorators"
import type { DoorBinding } from "./entity-engine-door.contracts"
import { EngineDoorService } from "./engine-door.service"
import { EntityEngineDoorErrorCode } from "./errors/entity-engine-door.error"

const binding = (scopeOpen = false): DoorBinding => ({
    workspaceId: "ws-1",
    effectKey: (step) => `job-1:${step}`,
    scopeOpen: () => scopeOpen,
})

const build = async (result: GatewayCallResult = { ok: true, value: { sent: true } }) => {
    const gateway = mock<McpGatewayService>()
    gateway.call.mockResolvedValue(result)
    const moduleRef = await Test.createTestingModule({
        providers: [
            EngineDoorService,
            { provide: McpGatewayService, useValue: gateway },
            {
                provide: ENTITY_ENGINE_DOOR_OPTIONS,
                useValue: { agentModule: "nivo" },
            },
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
        const result = await door.doorApi(binding()).call("chat.zalo.send", { to: "a" })
        expect(result).toEqual({ ok: true, output: { sent: true } })
        expect(gateway.call).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                agentId: agentIdFor("ws-1", "nivo"),
                conversationId: null,
                workItemId: null,
                audience: "internal",
                opKey: `job-1:chat.zalo.send:${argsHashOf({ to: "a" })}`,
            },
            "zalo.send",
            { to: "a" },
        )
    })

    it("maps a gateway refusal to a door failure", async () => {
        const { door } = await build({ ok: false, code: "not_granted", detail: "zalo.send" })
        expect(await door.doorApi(binding()).call("chat.zalo.send", {})).toEqual({
            ok: false,
            reason: "forbidden",
            message: "zalo.send",
        })
    })

    it("refuses a call while an engine scope is open, and never reaches the gateway", async () => {
        const { door, gateway } = await build()
        await expect(door.doorApi(binding(true)).call("chat.zalo.send", {})).rejects.toMatchObject({
            code: EntityEngineDoorErrorCode.InScope,
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("answers invalid for a tool name that is not <group>.<provider>.<action>", async () => {
        const { door, gateway } = await build()
        const result = await door.doorApi(binding()).call("Chat.zalo.send", {})
        expect(result).toEqual({ ok: false, reason: "invalid", message: "tool_malformed" })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("answers invalid for arguments the gateway cannot take", async () => {
        const { door, gateway } = await build()
        const result = await door.doorApi(binding()).call("chat.zalo.send", { nested: deepArgs() })
        expect(result).toEqual({ ok: false, reason: "invalid", message: "invalid_arguments" })
        expect(gateway.call).not.toHaveBeenCalled()
    })
})
