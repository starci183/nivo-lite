import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { nativeRefusal } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"
import { ProviderToolsService } from "./provider-tools.service"

const WS = "11111111-1111-4111-8111-111111111111"
const CONNECTION = "22222222-2222-4222-8222-222222222222"
const CALLER = { agentId: "a1", conversationId: null }

const connection = (changes: Partial<ConnectionStatusFacts> = {}): ConnectionStatusFacts => ({
    id: CONNECTION,
    provider: "telegram",
    name: "Shop bot",
    status: "connected",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    botUsername: "shop_bot",
    accountMasked: null,
    lastError: null,
    oaId: null,
    email: null,
    ...changes,
})

const build = async () => {
    const bindings = mock<ConnectionBindingsReadService>()
    bindings.ofProvider.mockResolvedValue([connection()])
    const views = mock<NativeViewService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ProviderToolsService,
            { provide: NativeViewService, useValue: views },
            { provide: ConnectionBindingsReadService, useValue: bindings },
        ],
    }).compile()
    return { tools: moduleRef.get(ProviderToolsService), bindings, views }
}

describe("ProviderToolsService connectionsOf", () => {
    it("lists the connections of the workspace under the provider", async () => {
        const { tools, bindings } = await build()

        await expect(tools.connectionsOf(WS, "telegram")).resolves.toEqual([connection()])
        expect(bindings.ofProvider).toHaveBeenCalledWith(WS, "telegram", 20)
    })

    it("refuses a workspace with no connection under the provider as not connected", async () => {
        const { tools, bindings } = await build()
        bindings.ofProvider.mockResolvedValue([])

        await expect(tools.connectionsOf(WS, "zalo_oa")).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
    })
})

describe("ProviderToolsService answer", () => {
    const route = {
        provider: "telegram",
        line: (found: ConnectionStatusFacts) => ({ id: found.id, handle: found.botUsername }),
    }

    it("answers the status of the connections as the route words them", async () => {
        const { tools } = await build()

        await expect(tools.answer(WS, route, "status.get", {}, CALLER)).resolves.toEqual({
            connections: [{ id: CONNECTION, handle: "shop_bot" }],
        })
    })

    it("refuses invalid arguments before reading anything", async () => {
        const { tools, bindings } = await build()

        await expect(tools.answer(WS, route, "status.get", { x: 1 }, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
            params: { tool: "status.get" },
        })
        expect(bindings.ofProvider).not.toHaveBeenCalled()
    })

    it("knows no other tool than status", async () => {
        const { tools } = await build()

        await expect(tools.answer(WS, route, "send", {}, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
        })
    })

    it("refuses a caller the view policy keeps out before reading a connection", async () => {
        const { tools, bindings, views } = await build()
        views.internalOf.mockRejectedValue(nativeRefusal("internal_only"))

        await expect(
            tools.answer(WS, route, "status.get", {}, { agentId: "a1", conversationId: "c1" }),
        ).rejects.toMatchObject({
            params: { reason: "internal_only" },
        })
        expect(views.internalOf).toHaveBeenCalledWith(WS, { agentId: "a1", conversationId: "c1" })
        expect(bindings.ofProvider).not.toHaveBeenCalled()
    })
})
