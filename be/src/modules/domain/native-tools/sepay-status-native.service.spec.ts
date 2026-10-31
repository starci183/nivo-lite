import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { McpGatewayErrorCode, SEPAY_MANIFEST, SepayNativeService } from "@modules/domain/mcp-gateway"
import { nativeRefusal } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"
import { ProviderToolsService } from "./provider-tools.service"
import type { ProviderRoute } from "./provider-tools.service"
import { SEPAY_STATUS_MANIFEST, SepayStatusNativeService } from "./sepay-status-native.service"

const WS = "11111111-1111-4111-8111-111111111111"
const CALLER = { agentId: "a1", conversationId: null }

const bank = (changes: Partial<ConnectionStatusFacts> = {}): ConnectionStatusFacts => ({
    id: "c1",
    provider: "sepay",
    name: "Bank",
    status: "connected",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    botUsername: null,
    accountMasked: "****6789",
    lastError: null,
    oaId: null,
    email: null,
    ...changes,
})

const build = async () => {
    const tools = mock<ProviderToolsService>()
    tools.answer.mockResolvedValue({ connections: [] })
    const sepay = mock<SepayNativeService>()
    sepay.invoke.mockResolvedValue({ transactions: [] })
    const views = mock<NativeViewService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayStatusNativeService,
            { provide: NativeViewService, useValue: views },
            { provide: ProviderToolsService, useValue: tools },
            { provide: SepayNativeService, useValue: sepay },
        ],
    }).compile()
    return { status: moduleRef.get(SepayStatusNativeService), tools, sepay, views }
}

/** The route the service hands the shared tools, read from its first call. */
const routeOf = (tools: jest.Mocked<ProviderToolsService>): ProviderRoute => {
    const [, route] = tools.answer.mock.calls[0] ?? []
    if (route === undefined) throw new Error("the shared tools were not called")
    return route
}

describe("SepayStatusNativeService manifest", () => {
    it("is the sepay connector with its two bank tools unchanged and a status tool beside them", () => {
        expect(SEPAY_STATUS_MANIFEST.key).toBe("sepay")
        expect(SEPAY_STATUS_MANIFEST.tools.map((tool) => tool.name)).toEqual([
            "transactions.list",
            "transactions.debits",
            "status",
        ])
        expect(SEPAY_STATUS_MANIFEST.tools.slice(0, 2)).toEqual(SEPAY_MANIFEST.tools)
        expect(SEPAY_STATUS_MANIFEST.tools[2]).toMatchObject({ scope: "read", defaultMode: "auto", internalOnly: true })
    })
})

describe("SepayStatusNativeService", () => {
    it("runs the bank tools through the ledger as before, and never through the status route", async () => {
        const { status, tools, sepay } = await build()

        await expect(status.invoke(WS, "transactions.list", { limit: 5 }, CALLER)).resolves.toEqual({ transactions: [] })

        expect(sepay.invoke).toHaveBeenCalledWith(WS, "transactions.list", { limit: 5 })
        expect(tools.answer).not.toHaveBeenCalled()
    })

    it("lets the bank adapter refuse a tool it does not have", async () => {
        const { status, sepay } = await build()
        sepay.invoke.mockRejectedValue({ code: McpGatewayErrorCode.UnknownTool })

        await expect(status.invoke(WS, "events", {}, CALLER)).rejects.toMatchObject({ code: McpGatewayErrorCode.UnknownTool })
    })

    it("runs the status tool of the sepay provider, which is no channel, through the shared tools", async () => {
        const { status, tools, sepay } = await build()

        await status.invoke(WS, "status", {}, CALLER)

        expect(tools.answer).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({ provider: "sepay", channel: null }),
            "status",
            {},
            CALLER,
        )
        expect(sepay.invoke).not.toHaveBeenCalled()
    })

    it("words a bank connection with its masked account and says whether it needs the owner", async () => {
        const { status, tools } = await build()
        await status.invoke(WS, "status", {}, CALLER)
        const { line } = routeOf(tools)

        expect(line(bank())).toEqual({
            id: "c1",
            name: "Bank",
            accountMasked: "****6789",
            status: "connected",
            needsAttention: false,
        })
        expect(line(bank({ accountMasked: null, status: "pending" }))).toEqual({
            id: "c1",
            name: "Bank",
            accountMasked: "",
            status: "pending",
            needsAttention: true,
        })
    })

    it("passes on the refusal of a workspace with no bank connection", async () => {
        const { status, tools } = await build()
        tools.answer.mockRejectedValue(nativeRefusal("not_connected"))

        await expect(status.invoke(WS, "status", {}, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
    })

    it.each(["status", "transactions.list", "transactions.debits"])(
        "refuses %s to a caller the view policy keeps out, before any bank or connection read",
        async (tool) => {
            const { status, tools, sepay, views } = await build()
            views.internalOf.mockRejectedValue(nativeRefusal("internal_only"))

            await expect(status.invoke(WS, tool, {}, { agentId: "a1", conversationId: "c1" })).rejects.toMatchObject({
                code: McpGatewayErrorCode.NativeRefused,
                params: { reason: "internal_only" },
            })
            expect(tools.answer).not.toHaveBeenCalled()
            expect(sepay.invoke).not.toHaveBeenCalled()
        },
    )
})
