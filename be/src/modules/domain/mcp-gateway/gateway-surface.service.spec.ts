import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { MCP_SERVER } from "@modules/integrations/mcp"
import type { McpServing, McpSurface } from "@modules/integrations/mcp"
import { McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import { GatewaySurfaceService } from "./gateway-surface.service"
import type { GatewayCaller } from "./mcp-gateway.contracts"
import { McpGatewayService } from "./mcp-gateway.service"

const CALLER: GatewayCaller = { workspaceId: "ws-1", agentId: "agent-1", conversationId: null, workItemId: null }
const MESSAGE = { jsonrpc: "2.0", id: 1, method: "tools/list" }
const REPLY = { body: { jsonrpc: "2.0" as const, id: 1, result: { tools: [] } } }

const build = async () => {
    const server = mock<McpServing>()
    server.answer.mockResolvedValue(REPLY)
    const gateway = mock<McpGatewayService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            GatewaySurfaceService,
            { provide: MCP_SERVER, useValue: server },
            { provide: McpGatewayService, useValue: gateway },
        ],
    }).compile()
    return { surface: moduleRef.get(GatewaySurfaceService), server, gateway }
}

/** The surface the service handed to the MCP server for the one message it answered. */
const surfaceOf = async (): Promise<{
    readonly handed: McpSurface
    readonly gateway: ReturnType<typeof mock<McpGatewayService>>
}> => {
    const { surface, server, gateway } = await build()
    await surface.answer({
        workspaceId: "ws-1",
        principal: { agentId: "agent-1", workspaceId: "ws-1" },
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

describe("GatewaySurfaceService tools", () => {
    it("searches the granted tools with the caller's query and limit, five by default", async () => {
        const { handed, gateway } = await surfaceOf()
        gateway.search.mockResolvedValue([])

        await expect(handed.call("tool.search", { query: "spa", limit: 3 })).resolves.toEqual({
            value: { tools: [] },
            isError: false,
        })
        await handed.call("tool.search", { query: 7 })
        expect(gateway.search.mock.calls).toEqual([
            [CALLER, "spa", 3],
            [CALLER, "", 5],
        ])
    })

    it("describes a granted tool, and answers an error for an unknown or ungranted one", async () => {
        const { handed, gateway } = await surfaceOf()
        const described = {
            name: "hakuen.stay.current",
            description: "Stay",
            scope: "read" as const,
            mode: "auto" as const,
            inputSchema: {},
            constraints: [],
            limitVnd: null,
        }
        gateway.describe.mockResolvedValueOnce(described).mockResolvedValueOnce(null)

        await expect(handed.call("tool.describe", { name: "hakuen.stay.current" })).resolves.toEqual({
            value: described,
            isError: false,
        })
        await expect(handed.call("tool.describe", {})).resolves.toEqual({
            value: { error: "not_granted_or_unknown" },
            isError: true,
        })
        expect(gateway.describe.mock.calls).toEqual([
            [CALLER, "hakuen.stay.current"],
            [CALLER, ""],
        ])
    })

    it("calls a tool through the gateway and answers its result or its refusal", async () => {
        const { handed, gateway } = await surfaceOf()
        gateway.call
            .mockResolvedValueOnce({ ok: true, value: { stay: null } })
            .mockResolvedValueOnce({ ok: false, code: "approval_required", reason: "ask_mode" })

        await expect(
            handed.call("tool.call", { name: "hakuen.stay.current", arguments: { room: "302" } }),
        ).resolves.toEqual({ value: { stay: null }, isError: false })
        await expect(handed.call("tool.call", { name: "hakuen.booking.cancel", arguments: [1] })).resolves.toEqual({
            value: { ok: false, code: "approval_required", reason: "ask_mode" },
            isError: true,
        })
        expect(gateway.call.mock.calls).toEqual([
            [CALLER, "hakuen.stay.current", { room: "302" }],
            [CALLER, "hakuen.booking.cancel", {}],
        ])
    })

    it("answers an error for a tool the surface does not have", async () => {
        const { handed } = await surfaceOf()

        await expect(handed.call("gateway.delete", {})).resolves.toEqual({
            value: { error: "unknown_tool" },
            isError: true,
        })
    })
})
