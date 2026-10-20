import { mock, mockEntityManager } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { GatewaySurfaceService, SURFACE_TOOLS } from "./gateway-surface.service"
import type { GatewayCaller } from "./mcp-gateway.contracts"
import { McpGatewayService } from "./mcp-gateway.service"

const CALLER: GatewayCaller = { workspaceId: "ws", agentId: "a1", conversationId: null, workItemId: null }

const WS = "12345678-1234-5678-9abc-123456789abc"
const AGENT = "22345678-1234-5678-9abc-123456789abc"

const build = (token: Secret | null = new Secret("agent-token"), rows: ReadonlyArray<unknown> = [{ id: AGENT }]) => {
    const gateway = mock<McpGatewayService>()
    const entityManager = mockEntityManager()
    entityManager.query.mockResolvedValue(rows)
    const options = { credentials: new Map<string, Secret>(), agentToken: token, defaultTimeoutMs: 4000 }
    return { surface: new GatewaySurfaceService(entityManager, options, gateway), gateway, entityManager }
}

describe("GatewaySurfaceService", () => {
    it("authenticates an agent of the workspace with the gateway token", async () => {
        await expect(build().surface.authenticate(WS, AGENT, "Bearer agent-token")).resolves.toEqual({
            workspaceId: WS,
            agentId: AGENT,
            conversationId: null,
            workItemId: null,
        })
        await expect(build().surface.authenticate(WS, AGENT, "Bearer wrong")).resolves.toBeNull()
        await expect(build().surface.authenticate(WS, AGENT, undefined)).resolves.toBeNull()
        await expect(build().surface.authenticate("x", AGENT, "Bearer agent-token")).resolves.toBeNull()
        await expect(build().surface.authenticate(WS, "x", "Bearer agent-token")).resolves.toBeNull()
        await expect(build(null).surface.authenticate(WS, AGENT, "Bearer agent-token")).resolves.toBeNull()
        await expect(
            build(new Secret("agent-token"), []).surface.authenticate(WS, AGENT, "Bearer agent-token"),
        ).resolves.toBeNull()
    })

    it("exposes exactly three tools", () => {
        expect(SURFACE_TOOLS.map((tool) => tool.name)).toEqual(["gateway.search", "gateway.describe", "gateway.call"])
    })

    it("searches with the given or the default limit", async () => {
        const { surface, gateway } = build()
        gateway.search.mockResolvedValue([])
        await expect(surface.run(CALLER, "gateway.search", { query: "spa", limit: 3 })).resolves.toEqual({
            value: { tools: [] },
            isError: false,
        })
        await surface.run(CALLER, "gateway.search", { query: 1 })
        expect(gateway.search.mock.calls).toEqual([
            [CALLER, "spa", 3],
            [CALLER, "", 5],
        ])
    })

    it("describes a granted tool, or answers an error", async () => {
        const { surface, gateway } = build()
        gateway.describe.mockResolvedValueOnce({
            name: "hakuen.rates.quote",
            description: "",
            scope: "read",
            mode: "auto",
            inputSchema: {},
            constraints: [],
            limitVnd: null,
        })
        await expect(surface.run(CALLER, "gateway.describe", { name: "hakuen.rates.quote" })).resolves.toMatchObject({
            isError: false,
            value: { name: "hakuen.rates.quote" },
        })
        gateway.describe.mockResolvedValueOnce(null)
        await expect(surface.run(CALLER, "gateway.describe", {})).resolves.toEqual({
            value: { error: "not_granted_or_unknown" },
            isError: true,
        })
    })

    it("calls through the gateway and answers its refusals as errors", async () => {
        const { surface, gateway } = build()
        gateway.call.mockResolvedValueOnce({ ok: true, value: { holdId: "h1" } })
        await expect(
            surface.run(CALLER, "gateway.call", { name: "hakuen.booking.hold", arguments: { roomType: "deluxe" } }),
        ).resolves.toEqual({ value: { holdId: "h1" }, isError: false })
        gateway.call.mockResolvedValueOnce({ ok: false, code: "approval_required", reason: "price_exception" })
        await expect(
            surface.run(CALLER, "gateway.call", { name: "hakuen.booking.confirm", arguments: [] }),
        ).resolves.toEqual({
            value: { ok: false, code: "approval_required", reason: "price_exception" },
            isError: true,
        })
        expect(gateway.call.mock.calls[1]).toEqual([CALLER, "hakuen.booking.confirm", {}])
    })

    it("refuses an unknown surface tool", async () => {
        await expect(build().surface.run(CALLER, "gateway.drop", {})).resolves.toEqual({
            value: { error: "unknown_tool" },
            isError: true,
        })
    })
})
