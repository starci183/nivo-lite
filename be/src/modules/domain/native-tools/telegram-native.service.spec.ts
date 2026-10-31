import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { nativeRefusal } from "./native-refusal.policy"
import { ProviderToolsService } from "./provider-tools.service"
import type { ProviderRoute } from "./provider-tools.service"
import { TELEGRAM_MANIFEST, TelegramNativeService } from "./telegram-native.service"

const WS = "11111111-1111-4111-8111-111111111111"
const CALLER = { agentId: "a1", conversationId: null }

const bot = (changes: Partial<ConnectionStatusFacts> = {}): ConnectionStatusFacts => ({
    id: "c1",
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
    const tools = mock<ProviderToolsService>()
    tools.answer.mockResolvedValue({ connections: [] })
    const moduleRef = await Test.createTestingModule({
        providers: [TelegramNativeService, { provide: ProviderToolsService, useValue: tools }],
    }).compile()
    return { telegram: moduleRef.get(TelegramNativeService), tools }
}

/** The route the service hands the shared tools, read from its first call. */
const routeOf = (tools: jest.Mocked<ProviderToolsService>): ProviderRoute => {
    const [, route] = tools.answer.mock.calls[0] ?? []
    assert(route !== undefined, "the shared tools were not called")
    return route
}

describe("TelegramNativeService", () => {
    it("declares a status and an events tool for internal use, the customer masked in the audit", () => {
        expect(TELEGRAM_MANIFEST.key).toBe("telegram")
        expect(
            TELEGRAM_MANIFEST.tools.map((tool) => [tool.name, tool.scope, tool.internalOnly, tool.secretFields]),
        ).toEqual([
            ["status", "read", true, undefined],
            ["events", "read", true, ["customerMasked"]],
        ])
    })

    it("runs the tools of the telegram provider on the telegram channel", async () => {
        const { telegram, tools } = await build()

        await expect(telegram.invoke(WS, "events", { connectionId: "c1" }, CALLER)).resolves.toEqual({
            connections: [],
        })

        expect(tools.answer).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({ provider: "telegram", channel: "telegram" }),
            "events",
            { connectionId: "c1" },
            CALLER,
        )
    })

    it("words a bot by its handle and says whether it needs the owner, never giving the failure text", async () => {
        const { telegram, tools } = await build()
        await telegram.invoke(WS, "status", {}, CALLER)
        const { line } = routeOf(tools)

        expect(line(bot())).toEqual({
            id: "c1",
            name: "Shop bot",
            handle: "shop_bot",
            status: "connected",
            needsAttention: false,
        })
        expect(line(bot({ botUsername: null, lastError: "webhook refused: 401" }))).toEqual({
            id: "c1",
            name: "Shop bot",
            handle: "",
            status: "connected",
            needsAttention: true,
        })
    })

    it("passes on the refusal of a workspace with no bot, which the gateway reads as an answer", async () => {
        const { telegram, tools } = await build()
        tools.answer.mockRejectedValue(nativeRefusal("not_connected"))

        await expect(telegram.invoke(WS, "status", {}, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
    })
})
