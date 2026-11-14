import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ToolRegistryService, argsHashOf, toolArgumentsSchema } from "@modules/domain/tools"
import type { ToolCallResult, WorkspaceToolFamily } from "@modules/domain/tools"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { DoorTool } from "@nivo-lite/agent-sdk/mutation"
import type { DoorBinding } from "./entity-engine-door.contracts"
import { EngineDoorService } from "./engine-door.service"
import { EntityEngineDoorErrorCode } from "./errors/entity-engine-door.error"

const NIVO_ID = "0b6e1c52-0000-4000-8000-000000000001"

const MODULE_AGENT = "0b6e1c52-0000-4000-8000-0000000000aa"
const SEND = "nivo.tool.customer.message.send"

const binding = (scopeOpen = false, agentId: string | undefined = undefined): DoorBinding => ({
    workspaceId: "ws-1",
    jobId: "job-1",
    agentId,
    effectKey: (step) => `job-1:${step}`,
    scopeOpen: () => scopeOpen,
})

const build = async (
    result: ToolCallResult = { ok: true, value: { sent: true } },
    connectors: ReadonlyArray<WorkspaceToolFamily> = [],
    nivoIds: Array<string> = [NIVO_ID],
) => {
    const gateway = mock<ToolRegistryService>()
    gateway.call.mockResolvedValue(result)
    gateway.familiesOf.mockReturnValue(connectors)
    const agents = mock<AgentDirectoryService>()
    agents.idsOfModule.mockResolvedValue(nivoIds)
    const moduleRef = await Test.createTestingModule({
        providers: [
            EngineDoorService,
            { provide: ToolRegistryService, useValue: gateway },
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
        const { door, gateway } = await build(undefined, [CHANNEL])
        const result = await door.doorApi(binding()).call("nivo.tool.team-chat.report.post", { to: "a" })
        expect(result).toEqual({ ok: true, output: { sent: true } })
        expect(gateway.call).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                agentId: NIVO_ID,
                conversationId: null,
                workItemId: null,
                audience: "internal",
                engine: true,
                // The engine's own caller states its road (a module's declared job), for the audit.
                origin: "engine_job",
                opKey: `job-1:nivo.tool.team-chat.report.post:${argsHashOf({ to: "a" })}`,
                turnId: "job-1",
            },
            "zalo.send",
            { to: "a" },
        )
    })

    it("calls the gateway as the seeded nivo agent of the workspace, and refuses when the workspace has none", async () => {
        const { door, gateway } = await build(undefined, [CHANNEL], [])
        await expect(door.doorApi(binding()).call("nivo.tool.team-chat.report.post", {})).rejects.toMatchObject({
            code: EntityEngineDoorErrorCode.NoAgent,
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("maps a gateway refusal to a door failure", async () => {
        const { door } = await build({ ok: false, code: "not_granted", detail: "zalo.send" }, [CHANNEL])
        expect(await door.doorApi(binding()).call("nivo.tool.team-chat.report.post", {})).toEqual({
            ok: false,
            reason: "forbidden",
            message: "zalo.send",
        })
    })

    it("refuses a call while an engine scope is open, and never reaches the gateway", async () => {
        const { door, gateway } = await build()
        await expect(door.doorApi(binding(true)).call("nivo.tool.team-chat.report.post", {})).rejects.toMatchObject({
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
        const result = await door.doorApi(binding()).call("nivo.tool.team-chat.report.post", { nested: deepArgs() })
        expect(result).toEqual({ ok: false, reason: "invalid", message: "invalid_arguments" })
        expect(gateway.call).not.toHaveBeenCalled()
    })
})

/** A connector of the workspace whose tool `send` plays the domain tool `nivo.tool.team-chat.report.post`. */
const CHANNEL = builder<WorkspaceToolFamily>({
    manifest: {
        key: "zalo",
        name: "Zalo",
        contractVersion: "zalo@1",
        tools: [
            {
                name: "send",
                description: "Send",
                scope: "write",
                defaultMode: "auto",
                inputSchema: {},
                argumentSchema: toolArgumentsSchema,
                domain: "nivo.tool.team-chat.report.post",
            },
        ],
    },
    timeoutMs: 4000,
})()

describe("EngineDoorService domain tools", () => {
    it("resolves a domain tool to the tool of the workspace's own connection that plays it", async () => {
        const { door, gateway } = await build({ ok: true, value: { sent: true } }, [CHANNEL])
        const result = await door.doorApi(binding()).call("nivo.tool.team-chat.report.post", { key: "m1" })
        expect(result).toEqual({ ok: true, output: { sent: true } })
        expect(gateway.familiesOf).toHaveBeenCalledWith()
        expect(gateway.call).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: "ws-1", opKey: `job-1:nivo.tool.team-chat.report.post:${argsHashOf({ key: "m1" })}` }),
            "zalo.send",
            { key: "m1" },
        )
    })

    it("answers unknown_tool for a domain tool no connection of the workspace plays, and calls nothing", async () => {
        const { door, gateway } = await build()
        expect(await door.doorApi(binding()).call("nivo.tool.team-chat.report.post", {})).toEqual({
            ok: false,
            reason: "unknown_tool",
            message: "no_provider",
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })
})

/** An installed effect: its tool's own full name is the domain tool, and no connection declares it. */
const EFFECTS = builder<WorkspaceToolFamily>({
    manifest: {
        key: "customer",
        namespace: "nivo.tool.customer",
        name: "NIVO customer",
        contractVersion: "nivo-effects@1",
        tools: [
            {
                name: "message.send",
                description: "Send",
                scope: "write",
                defaultMode: "ask",
                inputSchema: {},
                argumentSchema: toolArgumentsSchema,
            },
        ],
    },
    timeoutMs: 4000,
})()

describe("EngineDoorService the customer send", () => {
    it("calls an installed effect by its own full name, as the installed agent of the job's module, in the job run, under the business key", async () => {
        const { door, gateway } = await build({ ok: true, value: { kind: "message", id: "line-1" } }, [EFFECTS])
        const result = await door.doorApi(binding(false, MODULE_AGENT)).call(SEND, { contactId: "c-1", text: "Hi" }, { onceBy: "line-1" })
        expect(result).toEqual({ ok: true, output: { kind: "message", id: "line-1" } })
        expect(gateway.call).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                agentId: MODULE_AGENT,
                conversationId: null,
                workItemId: null,
                audience: "internal",
                engine: true,
                origin: "engine_job",
                opKey: `job-1:${SEND}:${argsHashOf({ contactId: "c-1", text: "Hi" })}`,
                turnId: "job-1",
                onceBy: "line-1",
            },
            SEND,
            { contactId: "c-1", text: "Hi" },
        )
    })

    it("calls the send of a job that answers on a route as a reply on that route, and a job that names none as a message of its own", async () => {
        const { door, gateway } = await build(undefined, [EFFECTS])
        await door.doorApi(binding(false, MODULE_AGENT)).call(SEND, { text: "Hi" }, { routeId: "route-1" })
        await door.doorApi(binding(false, MODULE_AGENT)).call(SEND, { text: "Hi" })
        expect(gateway.call.mock.calls.map(([caller]) => caller.conversationId)).toEqual(["route-1", null])
    })

    it("passes the member who typed what the job says to the gateway as the caller's byMember, and no member otherwise", async () => {
        const { door, gateway } = await build(undefined, [EFFECTS])
        await door.doorApi(binding(false, MODULE_AGENT)).call(SEND, { text: "Hi" }, { routeId: "route-1", byMember: "member-1" })
        await door.doorApi(binding(false, MODULE_AGENT)).call(SEND, { text: "Hi" }, { routeId: "route-1" })
        expect(gateway.call.mock.calls[0]?.[0]).toMatchObject({ byMember: "member-1" })
        expect(gateway.call.mock.calls[1]?.[0]).not.toHaveProperty("byMember")
    })

    it("refuses the send of a job whose module has no installed agent, and never reaches the gateway", async () => {
        const { door, gateway } = await build(undefined, [EFFECTS])
        expect(await door.doorApi(binding()).call(SEND, { text: "Hi" })).toEqual({ ok: false, reason: "forbidden", message: "no_agent" })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("sets no business key unless the job names one, and keeps the other grants on the internal agent", async () => {
        const { door, gateway } = await build(undefined, [CHANNEL])
        await door.doorApi(binding(false, MODULE_AGENT)).call("nivo.tool.team-chat.report.post", { to: "a" })
        expect(gateway.call).toHaveBeenCalledWith(
            expect.not.objectContaining({ onceBy: expect.anything() }),
            "zalo.send",
            { to: "a" },
        )
        expect(gateway.call).toHaveBeenCalledWith(expect.objectContaining({ agentId: NIVO_ID }), "zalo.send", { to: "a" })
    })
})
