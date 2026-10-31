import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { nativeRefusal } from "./native-refusal.policy"
import { ProviderToolsService } from "./provider-tools.service"
import type { ProviderRoute } from "./provider-tools.service"
import { ZALO_MANIFEST, ZaloNativeService } from "./zalo-native.service"

const WS = "11111111-1111-4111-8111-111111111111"

const account = (changes: Partial<ConnectionStatusFacts> = {}): ConnectionStatusFacts => ({
    id: "c1",
    provider: "zalo_oa",
    name: "Shop OA",
    status: "connected",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    botUsername: null,
    accountMasked: null,
    lastError: null,
    oaId: "1234567890",
    email: null,
    ...changes,
})

const build = async () => {
    const tools = mock<ProviderToolsService>()
    tools.answer.mockResolvedValue({ connections: [] })
    const moduleRef = await Test.createTestingModule({
        providers: [ZaloNativeService, { provide: ProviderToolsService, useValue: tools }],
    }).compile()
    return { zalo: moduleRef.get(ZaloNativeService), tools }
}

/** The route the service hands the shared tools, read from its first call. */
const routeOf = (tools: jest.Mocked<ProviderToolsService>): ProviderRoute => {
    const [, route] = tools.answer.mock.calls[0] ?? []
    if (route === undefined) throw new Error("the shared tools were not called")
    return route
}

describe("ZaloNativeService", () => {
    it("declares a status and an events tool for internal use, the customer masked in the audit", () => {
        expect(ZALO_MANIFEST.key).toBe("zalo")
        expect(ZALO_MANIFEST.tools.map((tool) => [tool.name, tool.scope, tool.internalOnly, tool.secretFields])).toEqual([
            ["status", "read", true, undefined],
            ["events", "read", true, ["customerMasked"]],
        ])
    })

    it("runs the tools of the zalo_oa provider on the zalo channel", async () => {
        const { zalo, tools } = await build()

        await expect(zalo.invoke(WS, "status", {})).resolves.toEqual({ connections: [] })

        expect(tools.answer).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({ provider: "zalo_oa", channel: "zalo" }),
            "status",
            {},
        )
    })

    it("words an official account by its id and says whether it needs the owner, never giving the failure text", async () => {
        const { zalo, tools } = await build()
        await zalo.invoke(WS, "status", {})
        const { line } = routeOf(tools)

        expect(line(account())).toEqual({
            id: "c1",
            name: "Shop OA",
            oaId: "1234567890",
            status: "connected",
            needsAttention: false,
        })
        expect(line(account({ oaId: null, status: "error", lastError: "token refused: 401" }))).toEqual({
            id: "c1",
            name: "Shop OA",
            oaId: "",
            status: "error",
            needsAttention: true,
        })
    })

    it("passes on the refusal of a workspace with no official account, which the gateway reads as an answer", async () => {
        const { zalo, tools } = await build()
        tools.answer.mockRejectedValue(nativeRefusal("not_connected"))

        await expect(zalo.invoke(WS, "events", { connectionId: "c1" })).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
    })
})
