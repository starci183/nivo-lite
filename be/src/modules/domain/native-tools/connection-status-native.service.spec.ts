import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { ToolsErrorCode, PROVIDER_CATALOGUE, toolNameOf } from "@modules/domain/tools"
import { CONNECTION_STATUS_PROVIDERS, CONNECTION_STATUS_SCHEMA } from "./connection-status-native.schema"
import { CONNECTION_MANIFEST, ConnectionStatusNativeService } from "./connection-status-native.service"
import { nativeRefusal } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"
import { ProviderToolsService } from "./provider-tools.service"

const WS = "11111111-1111-4111-8111-111111111111"
const CALLER = { agentId: "a1", conversationId: null }

const account = (changes: Partial<ConnectionStatusFacts> = {}): ConnectionStatusFacts => ({
    id: "c1",
    provider: "sepay",
    name: "Bank",
    status: "connected",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    botUsername: null,
    accountMasked: null,
    lastError: null,
    oaId: null,
    email: null,
    ...changes,
})

const BANK = account({ id: "b1", accountMasked: "****6789" })
const OA = account({ id: "z1", provider: "zalo_oa", name: "Shop OA", oaId: "1234567890" })
const BOT = account({ id: "t1", provider: "telegram", name: "Shop bot", botUsername: "shop_bot", status: "error" })

const build = async (accounts: Readonly<Record<string, ReadonlyArray<ConnectionStatusFacts>>> = {}) => {
    const tools = mock<ProviderToolsService>()
    tools.accountsOf.mockImplementation((_workspaceId, provider) => Promise.resolve(accounts[provider] ?? []))
    const views = mock<NativeViewService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionStatusNativeService,
            { provide: NativeViewService, useValue: views },
            { provide: ProviderToolsService, useValue: tools },
        ],
    }).compile()
    return { status: moduleRef.get(ConnectionStatusNativeService), tools, views }
}

const ALL = { sepay: [BANK], zalo_oa: [OA], telegram: [BOT] }

describe("ConnectionStatusNativeService manifest", () => {
    it("is one read tool for internal use, named as the platform's purpose, with a part per registered provider", () => {
        expect(CONNECTION_MANIFEST.key).toBe("connection")
        expect(CONNECTION_MANIFEST.tools.map((tool) => toolNameOf(CONNECTION_MANIFEST, tool.name))).toEqual([
            TOOL.connectionStatusGet,
        ])
        expect(CONNECTION_MANIFEST.tools[0]).toMatchObject({
            name: "status.get",
            scope: "read",
            defaultMode: "auto",
            internalOnly: true,
            providerParts: ["sepay", "zalo_oa", "telegram"],
        })
    })

    it("registers only providers of the provider catalogue, and takes no other provider", () => {
        expect(
            CONNECTION_STATUS_PROVIDERS.filter((provider) => !PROVIDER_CATALOGUE.some((spec) => spec.provider === provider)),
        ).toEqual([])
        expect(CONNECTION_STATUS_SCHEMA.safeParse({}).success).toBe(true)
        expect(CONNECTION_STATUS_SCHEMA.safeParse({ provider: "zalo_oa" }).success).toBe(true)
        expect(CONNECTION_STATUS_SCHEMA.safeParse({ provider: "zalo" }).success).toBe(false)
        expect(CONNECTION_STATUS_SCHEMA.safeParse({ connectionId: "c1" }).success).toBe(false)
    })
})

describe("ConnectionStatusNativeService", () => {
    it("answers every provider's accounts, each worded as its own status tool worded it", async () => {
        const { status } = await build(ALL)

        await expect(status.invoke(WS, "status.get", {}, CALLER)).resolves.toEqual({
            providers: [
                {
                    provider: "sepay",
                    connections: [
                        { id: "b1", name: "Bank", accountMasked: "****6789", status: "connected", needsAttention: false },
                    ],
                },
                {
                    provider: "zalo_oa",
                    connections: [
                        { id: "z1", name: "Shop OA", oaId: "1234567890", status: "connected", needsAttention: false },
                    ],
                },
                {
                    provider: "telegram",
                    connections: [{ id: "t1", name: "Shop bot", handle: "shop_bot", status: "error", needsAttention: true }],
                },
            ],
        })
    })

    it("answers only the parts the gateway let through", async () => {
        const { status, tools } = await build(ALL)

        const answer = await status.invoke(
            WS,
            "status.get",
            {},
            { ...CALLER, parts: [{ provider: "zalo_oa" }] },
        )

        expect(answer).toEqual({
            providers: [
                {
                    provider: "zalo_oa",
                    connections: [{ id: "z1", name: "Shop OA", oaId: "1234567890", status: "connected", needsAttention: false }],
                },
            ],
        })
        expect(tools.accountsOf).toHaveBeenCalledTimes(1)
    })

    it("answers the one provider named, and refuses it as not connected when it has no account", async () => {
        const { status } = await build({ zalo_oa: [OA] })

        await expect(status.invoke(WS, "status.get", { provider: "zalo_oa" }, CALLER)).resolves.toEqual({
            providers: [
                {
                    provider: "zalo_oa",
                    connections: [
                        { id: "z1", name: "Shop OA", oaId: "1234567890", status: "connected", needsAttention: false },
                    ],
                },
            ],
        })
        await expect(status.invoke(WS, "status.get", { provider: "sepay" }, CALLER)).rejects.toMatchObject({
            code: ToolsErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
    })

    it("lists a provider with no account empty beside one that has, and refuses when none has any", async () => {
        const { status } = await build({ telegram: [BOT] })

        await expect(status.invoke(WS, "status.get", {}, CALLER)).resolves.toMatchObject({
            providers: [
                { provider: "sepay", connections: [] },
                { provider: "zalo_oa", connections: [] },
                { provider: "telegram", connections: [expect.objectContaining({ id: "t1" })] },
            ],
        })
        const empty = await build()
        await expect(empty.status.invoke(WS, "status.get", {}, CALLER)).rejects.toMatchObject({
            params: { reason: "not_connected" },
        })
    })

    it("refuses invalid arguments and an unknown tool before reading anything", async () => {
        const { status, tools } = await build(ALL)

        await expect(status.invoke(WS, "status.get", { provider: "zalo" }, CALLER)).rejects.toMatchObject({
            code: ToolsErrorCode.InvalidArguments,
        })
        await expect(status.invoke(WS, "send", {}, CALLER)).rejects.toMatchObject({
            code: ToolsErrorCode.UnknownTool,
        })
        expect(tools.accountsOf).not.toHaveBeenCalled()
    })

    it("refuses a caller the view policy keeps out before reading a connection", async () => {
        const { status, tools, views } = await build(ALL)
        views.internalOf.mockRejectedValue(nativeRefusal("internal_only"))

        await expect(
            status.invoke(WS, "status.get", {}, { agentId: "a1", conversationId: "c1" }),
        ).rejects.toMatchObject({ params: { reason: "internal_only" } })
        expect(views.internalOf).toHaveBeenCalledWith(WS, { agentId: "a1", conversationId: "c1" })
        expect(tools.accountsOf).not.toHaveBeenCalled()
    })
})
