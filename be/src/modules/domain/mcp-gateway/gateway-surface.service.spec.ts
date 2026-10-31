import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentViewScopeService } from "@modules/domain/agents"
import { MCP_SERVER } from "@modules/integrations/mcp"
import type { McpServing, McpSurface } from "@modules/integrations/mcp"
import { McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import { GatewaySurfaceService } from "./gateway-surface.service"
import {
    GATEWAY_CALL_INPUT_SCHEMA,
    GATEWAY_DESCRIBE_INPUT_SCHEMA,
    GATEWAY_SEARCH_INPUT_SCHEMA,
} from "./gateway-tools.schema"
import type { GatewayCaller } from "./mcp-gateway.contracts"
import { McpGatewayService } from "./mcp-gateway.service"

const CALLER: GatewayCaller = { workspaceId: "ws-1", agentId: "agent-1", conversationId: null, workItemId: null, audience: "internal" }
const MESSAGE = { jsonrpc: "2.0", id: 1, method: "tools/list" }
const REPLY = { body: { jsonrpc: "2.0" as const, id: 1, result: { tools: [] } } }
const READ = {
    name: "hakuen.stay.current",
    description: "Stay",
    scope: "read" as const,
    mode: "auto" as const,
    inputSchema: {},
    constraints: [],
    limitVnd: null,
}

const build = async () => {
    const server = mock<McpServing>()
    server.answer.mockResolvedValue(REPLY)
    const gateway = mock<McpGatewayService>()
    const scopes = mock<AgentViewScopeService>()
    scopes.lensOf.mockResolvedValue({ module: "sales", installationId: null })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GatewaySurfaceService,
            { provide: MCP_SERVER, useValue: server },
            { provide: McpGatewayService, useValue: gateway },
            { provide: AgentViewScopeService, useValue: scopes },
        ],
    }).compile()
    return { surface: moduleRef.get(GatewaySurfaceService), server, gateway, scopes }
}

/** The surface the service handed to the MCP server for the one message it answered. */
const surfaceOf = async (
    agentId: string = CALLER.agentId,
): Promise<{
    readonly handed: McpSurface
    readonly gateway: ReturnType<typeof mock<McpGatewayService>>
}> => {
    const { surface, server, gateway } = await build()
    await surface.answer({
        workspaceId: "ws-1",
        principal: { agentId, workspaceId: "ws-1" },
        message: MESSAGE,
    })
    const handed = server.answer.mock.calls[0]?.[0].surface
    assert(handed !== undefined, "the surface was not handed to the server")
    return { handed, gateway }
}

describe("GatewaySurfaceService.answer", () => {
    it("answers the message over the three surface tools for the agent the credential names", async () => {
        const { surface, server } = await build()

        await expect(
            surface.answer({
                workspaceId: "ws-1",
                principal: { agentId: "agent-1", workspaceId: "ws-1" },
                message: MESSAGE,
            }),
        ).resolves.toBe(REPLY)
        const handed = server.answer.mock.calls[0]?.[0]
        expect(handed?.message).toBe(MESSAGE)
        expect(handed?.surface.tools.map((tool) => tool.name)).toEqual(["tool.search", "tool.describe", "tool.call"])
        expect(handed?.surface.tools.map((tool) => tool.inputSchema)).toEqual([
            GATEWAY_SEARCH_INPUT_SCHEMA,
            GATEWAY_DESCRIBE_INPUT_SCHEMA,
            GATEWAY_CALL_INPUT_SCHEMA,
        ])
        expect(handed?.surface.tools[0]?.inputSchema).toMatchObject({
            properties: {
                query: { type: "string", maxLength: 200 },
                limit: { type: "integer", minimum: 1, maximum: 10 },
            },
        })
        expect(handed?.surface.tools[1]?.inputSchema).toMatchObject({
            properties: { name: { type: "string", minLength: 1, maxLength: 113 } },
        })
        expect(handed?.surface.tools[2]?.inputSchema).toMatchObject({
            properties: { name: { type: "string", minLength: 1, maxLength: 113 } },
        })
    })

    it("refuses a credential of another workspace before the server answers", async () => {
        const { surface, server } = await build()

        await expect(
            surface.answer({
                workspaceId: "ws-1",
                principal: { agentId: "agent-1", workspaceId: "ws-2" },
                message: MESSAGE,
            }),
        ).rejects.toMatchObject({ code: McpGatewayErrorCode.WorkspaceMismatch })
        expect(server.answer).not.toHaveBeenCalled()
    })
})

describe("GatewaySurfaceService audience", () => {
    it.each([
        ["a customer-facing module", { module: "chatbot", installationId: null }, "customer"],
        ["a publishing module", { module: "content", installationId: null }, "customer"],
        ["an agent the workspace does not hold", null, "customer"],
        ["a staff-facing module", { module: "sales", installationId: null }, "internal"],
    ] as const)("gives the agent of %s the %s audience on the door", async (_label, scope, audience) => {
        const { surface, server, gateway, scopes } = await build()
        scopes.lensOf.mockResolvedValue(scope)
        gateway.search.mockResolvedValue([])
        await surface.answer({
            workspaceId: "ws-1",
            principal: { agentId: "agent-1", workspaceId: "ws-1" },
            message: MESSAGE,
        })
        const handed = server.answer.mock.calls[0]?.[0].surface
        assert(handed !== undefined, "the surface was not handed to the server")

        await handed.call("tool.search", { query: "bank" })

        expect(scopes.lensOf).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(gateway.search).toHaveBeenCalledWith(expect.objectContaining({ conversationId: null, audience }), "bank", 5)
    })
})

describe("GatewaySurfaceService discovery", () => {
    it("searches the granted tools with the caller's query and limit, five by default", async () => {
        const { handed, gateway } = await surfaceOf()
        gateway.search.mockResolvedValue([])

        await expect(handed.call("tool.search", { query: "spa", limit: 3 })).resolves.toEqual({
            value: { tools: [] },
            isError: false,
        })
        await handed.call("tool.search", { query: "" })
        expect(gateway.search.mock.calls).toEqual([
            [CALLER, "spa", 3],
            [CALLER, "", 5],
        ])
    })

    it("describes a granted tool, and answers an error for an unknown or ungranted one", async () => {
        const { handed, gateway } = await surfaceOf()
        const described = READ
        gateway.describe.mockResolvedValueOnce(described).mockResolvedValueOnce(null)

        await expect(handed.call("tool.describe", { name: "hakuen.stay.current" })).resolves.toEqual({
            value: described,
            isError: false,
        })
        await expect(handed.call("tool.describe", { name: "hakuen.unknown" })).resolves.toEqual({
            value: { error: "not_granted_or_unknown" },
            isError: true,
        })
        expect(gateway.describe.mock.calls).toEqual([
            [CALLER, "hakuen.stay.current"],
            [CALLER, "hakuen.unknown"],
        ])
    })
})

describe("GatewaySurfaceService calls", () => {
    it("calls a tool through the gateway and answers its result or its refusal", async () => {
        const { handed, gateway } = await surfaceOf()
        gateway.describe.mockResolvedValue(READ)
        gateway.call
            .mockResolvedValueOnce({ ok: true, value: { stay: null } })
            .mockResolvedValueOnce({ ok: false, code: "approval_required", reason: "ask_mode" })

        await expect(
            handed.call("tool.call", { name: "hakuen.stay.current", arguments: { room: "302" } }),
        ).resolves.toEqual({ value: { stay: null }, isError: false })
        await expect(handed.call("tool.call", { name: "hakuen.booking.cancel", opKey: "cancel-1" })).resolves.toEqual({
            value: { ok: false, code: "approval_required", reason: "ask_mode" },
            isError: true,
        })
        expect(gateway.call.mock.calls).toEqual([
            [CALLER, "hakuen.stay.current", { room: "302" }],
            [{ ...CALLER, opKey: "mcp:agent-1:cancel-1" }, "hakuen.booking.cancel", {}],
        ])
    })

    it("carries the same explicit operation key on retried writes and advertises it to clients", async () => {
        const { handed, gateway } = await surfaceOf()
        gateway.call.mockResolvedValue({ ok: true, value: { holdId: "h1" } })
        const request = { name: "hakuen.booking.hold", arguments: { room: "302" }, opKey: "  hold-1  " }

        await handed.call("tool.call", request)
        await handed.call("tool.call", request)

        expect(gateway.call.mock.calls).toEqual([
            [{ ...CALLER, opKey: "mcp:agent-1:hold-1" }, "hakuen.booking.hold", { room: "302" }],
            [{ ...CALLER, opKey: "mcp:agent-1:hold-1" }, "hakuen.booking.hold", { room: "302" }],
        ])
        expect(handed.tools.find((tool) => tool.name === "tool.call")?.inputSchema).toMatchObject({
            properties: { opKey: { type: "string" } },
        })
    })

    it("keeps the same client operation key isolated between authenticated agents", async () => {
        const first = await surfaceOf()
        const second = await surfaceOf("agent-2")
        first.gateway.call.mockResolvedValue({ ok: true, value: { holdId: "h1" } })
        second.gateway.call.mockResolvedValue({ ok: true, value: { holdId: "h2" } })
        const request = { name: "hakuen.booking.hold", opKey: "hold-1" }

        await first.handed.call("tool.call", request)
        await second.handed.call("tool.call", request)

        expect(first.gateway.call).toHaveBeenCalledWith(
            { ...CALLER, opKey: "mcp:agent-1:hold-1" },
            "hakuen.booking.hold",
            {},
        )
        expect(second.gateway.call).toHaveBeenCalledWith(
            { ...CALLER, agentId: "agent-2", opKey: "mcp:agent-2:hold-1" },
            "hakuen.booking.hold",
            {},
        )
    })
})

describe("GatewaySurfaceService call validation", () => {
    it("passes an empty object when the client omitted tool arguments", async () => {
        const { handed, gateway } = await surfaceOf()
        gateway.call.mockResolvedValue({ ok: true, value: {} })

        await handed.call("tool.call", { name: "hakuen.stay.current", opKey: "read-1" })

        expect(gateway.call).toHaveBeenCalledWith({ ...CALLER, opKey: "mcp:agent-1:read-1" }, "hakuen.stay.current", {})
    })

    it.each([undefined, "   "])("refuses a write without a usable operation key (%s)", async (opKey) => {
        const { handed, gateway } = await surfaceOf()
        gateway.describe.mockResolvedValue({ ...READ, name: "hakuen.booking.hold", scope: "write" })
        gateway.call.mockResolvedValue({ ok: true, value: { holdId: "h1" } })

        await expect(handed.call("tool.call", { name: "hakuen.booking.hold", opKey })).resolves.toEqual({
            value: { error: "idempotency_key_required" },
            isError: true,
        })
        expect(gateway.describe).toHaveBeenCalledWith(CALLER, "hakuen.booking.hold")
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("refuses an unknown or ungranted tool before considering a keyless write", async () => {
        const { handed, gateway } = await surfaceOf()
        gateway.describe.mockResolvedValue(null)

        await expect(handed.call("tool.call", { name: "hakuen.unknown" })).resolves.toEqual({
            value: { error: "not_granted_or_unknown" },
            isError: true,
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("answers an error for a tool the surface does not have", async () => {
        const { handed } = await surfaceOf()

        await expect(handed.call("gateway.delete", {})).resolves.toEqual({
            value: { error: "unknown_tool" },
            isError: true,
        })
    })
})

describe("GatewaySurfaceService invalid tools", () => {
    it.each([
        { tool: "tool.search", args: {} },
        { tool: "tool.search", args: { query: 7 } },
        { tool: "tool.search", args: { query: "a".repeat(201) } },
        { tool: "tool.search", args: { query: "spa", limit: 0 } },
        { tool: "tool.search", args: { query: "spa", limit: 11 } },
        { tool: "tool.search", args: { query: "spa", limit: 1.5 } },
        { tool: "tool.search", args: { query: "spa", limit: "5" } },
        { tool: "tool.describe", args: {} },
        { tool: "tool.describe", args: { name: 7 } },
        { tool: "tool.describe", args: { name: "" } },
        { tool: "tool.describe", args: { name: "a".repeat(114) } },
        { tool: "tool.call", args: { name: "hakuen.stay.current", opKey: 42 } },
        { tool: "tool.call", args: { name: "hakuen.stay.current", opKey: "k".repeat(201) } },
        { tool: "tool.call", args: { name: "hakuen.stay.current", arguments: { text: "x".repeat(8193) } } },
        { tool: "tool.call", args: {} },
        { tool: "tool.call", args: { name: 7 } },
        { tool: "tool.call", args: { name: "" } },
        { tool: "tool.call", args: { name: "a".repeat(114) } },
        { tool: "tool.call", args: { name: "hakuen.stay.current", arguments: [1] } },
        { tool: "tool.call", args: { name: "hakuen.stay.current", arguments: null } },
    ])("answers an MCP tool error before using the gateway for invalid arguments: %p", async ({ tool, args }) => {
        const { handed, gateway } = await surfaceOf()

        await expect(handed.call(tool, args)).resolves.toEqual({
            value: { error: "invalid_arguments" },
            isError: true,
        })
        expect(gateway.search).not.toHaveBeenCalled()
        expect(gateway.describe).not.toHaveBeenCalled()
        expect(gateway.call).not.toHaveBeenCalled()
    })
})
