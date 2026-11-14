import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { ToolsErrorCode } from "@modules/domain/tools"
import { ProviderToolsService } from "./provider-tools.service"

const WS = "11111111-1111-4111-8111-111111111111"
const CONNECTION = "22222222-2222-4222-8222-222222222222"

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
    const moduleRef = await Test.createTestingModule({
        providers: [ProviderToolsService, { provide: ConnectionBindingsReadService, useValue: bindings }],
    }).compile()
    return { tools: moduleRef.get(ProviderToolsService), bindings }
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
            code: ToolsErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
    })
})

describe("ProviderToolsService accountsOf", () => {
    it("lists the connections of the workspace under the provider, an empty list for none", async () => {
        const { tools, bindings } = await build()

        await expect(tools.accountsOf(WS, "telegram")).resolves.toEqual([connection()])
        bindings.ofProvider.mockResolvedValue([])
        await expect(tools.accountsOf(WS, "zalo_oa")).resolves.toEqual([])
        expect(bindings.ofProvider).toHaveBeenCalledWith(WS, "zalo_oa", 20)
    })
})
