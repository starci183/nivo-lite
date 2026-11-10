import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { ConnectionRecord, ConnectionStatusFacts } from "@modules/domain/connections"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { BankTransactionsRegistryService } from "@modules/domain/provider-registry"
import type { BankTransaction } from "@modules/domain/provider-registry"
import { ProviderAbilitiesService } from "@modules/domain/mcp-gateway"
import { BANK_MANIFEST, BankNativeService } from "./bank-native.service"
import type { NativeView } from "./native-view.policy"
import { NativeViewService } from "./native-view.service"

const CALLER = { agentId: "agent-1", conversationId: null }
const TRANSACTION: BankTransaction = {
    id: "sepay:95958515",
    direction: "credit",
    amountVnd: 5000,
    content: "BUI NGUYEN DINH",
    occurredAt: "2026-11-03T18:06:00.000Z",
    bankName: "MBBank",
}

const feed = (status: ConnectionStatusFacts["status"]): ConnectionStatusFacts => ({
    id: "conn-1",
    provider: "sepay",
    name: "SePay",
    status,
    createdAt: new Date("2026-11-03T00:00:00.000Z"),
    botUsername: null,
    accountMasked: null,
    lastError: null,
    oaId: null,
    email: null,
})

const record = (environment: ConnectionRecord["environment"]): ConnectionRecord => ({
    id: "conn-1",
    workspaceId: "ws-1",
    provider: "sepay",
    name: "SePay",
    meta: {},
    status: "connected",
    lastError: null,
    environment,
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: null,
    createdAt: "2026-11-03T00:00:00.000Z",
})

const VIEW: NativeView = {
    workspaceId: "ws-1",
    module: "accounting",
    audience: "internal",
    installationId: null,
    searchable: true,
}

const build = async () => {
    const views = mock<NativeViewService>()
    views.internalOf.mockResolvedValue(VIEW)
    const bindings = mock<ConnectionBindingsReadService>()
    const transactions = jest.fn().mockResolvedValue([TRANSACTION])
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankNativeService,
            BankTransactionsRegistryService,
            { provide: NativeViewService, useValue: views },
            { provide: ConnectionBindingsReadService, useValue: bindings },
        ],
    }).compile()
    moduleRef.get(BankTransactionsRegistryService).register({ provider: "sepay", transactions })
    return { service: moduleRef.get(BankNativeService), views, bindings, transactions }
}

describe("BankNativeService", () => {
    it("announces one internal read tool named by the capability", () => {
        expect(BANK_MANIFEST.key).toBe("bank")
        expect(BANK_MANIFEST.tools[0]).toMatchObject({ name: "transactions", scope: "read", internalOnly: true })
    })

    it("lists the transactions of the live feed through the provider that registered, with the window the caller named", async () => {
        const { service, views, bindings, transactions } = await build()
        bindings.ofProvider.mockResolvedValue([feed("connected")])
        bindings.recordOf.mockResolvedValue(record("live"))

        const answer = await service.invoke(
            "ws-1",
            "transactions",
            { since: "2026-11-01T00:00:00.000Z", until: "2026-11-04T00:00:00.000Z", limit: 5 },
            CALLER,
        )

        expect(views.internalOf).toHaveBeenCalledWith("ws-1", CALLER)
        expect(answer).toEqual({
            provider: "sepay",
            transactions: [{ ...TRANSACTION, connectionId: "conn-1", account: "SePay" }],
        })
        expect(transactions).toHaveBeenCalledWith(record("live"), {
            since: new Date("2026-11-01T00:00:00.000Z"),
            until: new Date("2026-11-04T00:00:00.000Z"),
            limit: 5,
        })
    })

    it("passes no window when the caller names none and defaults the limit", async () => {
        const { service, bindings, transactions } = await build()
        bindings.ofProvider.mockResolvedValue([feed("connected")])
        bindings.recordOf.mockResolvedValue(record("live"))

        await service.invoke("ws-1", "transactions", {}, CALLER)

        expect(transactions).toHaveBeenCalledWith(record("live"), { since: undefined, until: undefined, limit: 20 })
    })

    it.each([
        ["no feed", []],
        ["only a disconnected feed", [feed("disconnected")]],
    ])("is not connected with %s", async (_name, feeds) => {
        const { service, bindings } = await build()
        bindings.ofProvider.mockResolvedValue(feeds)

        await expect(service.invoke("ws-1", "transactions", {}, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
    })

    it("is not connected when the feed runs in test, vanished or cannot be read yet", async () => {
        const { service, bindings, transactions } = await build()
        bindings.ofProvider.mockResolvedValue([feed("connected")])
        const cases: Array<ConnectionRecord | null> = [record("test"), null]

        for (const found of cases) {
            bindings.recordOf.mockResolvedValueOnce(found)
            await expect(service.invoke("ws-1", "transactions", {}, CALLER)).rejects.toMatchObject({
                params: { reason: "not_connected" },
            })
        }
        bindings.recordOf.mockResolvedValueOnce(record("live"))
        transactions.mockResolvedValueOnce(undefined)
        await expect(service.invoke("ws-1", "transactions", {}, CALLER)).rejects.toMatchObject({
            params: { reason: "not_connected" },
        })
    })

    it("refuses arguments outside the schema and tools it does not have", async () => {
        const { service } = await build()

        await expect(service.invoke("ws-1", "transactions", { limit: 0 }, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
        })
        await expect(service.invoke("ws-1", "other", {}, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
        })
    })

    it("reads every account the calling agent may read, each movement naming its account, and none it may not", async () => {
        const views = mock<NativeViewService>()
        views.internalOf.mockResolvedValue(VIEW)
        const bindings = mock<ConnectionBindingsReadService>()
        const abilities = mock<ProviderAbilitiesService>()
        abilities.accountsOfAgent.mockResolvedValue(["mb", "vcb"])
        const transactions = jest.fn((connection: ConnectionRecord) =>
            Promise.resolve([{ ...TRANSACTION, id: `tx-${connection.id}`, occurredAt: connection.id === "mb" ? "2026-11-02" : "2026-11-03" }]),
        )
        const moduleRef = await Test.createTestingModule({
            providers: [
                BankNativeService,
                BankTransactionsRegistryService,
                { provide: NativeViewService, useValue: views },
                { provide: ConnectionBindingsReadService, useValue: bindings },
                { provide: ProviderAbilitiesService, useValue: abilities },
            ],
        }).compile()
        moduleRef.get(BankTransactionsRegistryService).register({ provider: "sepay", transactions })
        bindings.ofProvider.mockResolvedValue(["mb", "vcb", "acb"].map((id) => ({ ...feed("connected"), id })))
        bindings.recordOf.mockImplementation((_workspaceId, id) => Promise.resolve({ ...record("live"), id, name: `Account ${id}` }))
        const service = moduleRef.get(BankNativeService)

        const answer = await service.invoke("ws-1", "transactions", {}, CALLER)

        expect(abilities.accountsOfAgent).toHaveBeenCalledWith("ws-1", CALLER.agentId, "bank.transactions")
        expect(answer).toMatchObject({
            provider: "sepay",
            transactions: [
                { id: "tx-vcb", connectionId: "vcb", account: "Account vcb" },
                { id: "tx-mb", connectionId: "mb", account: "Account mb" },
            ],
        })
        expect(transactions).toHaveBeenCalledTimes(2)

        abilities.accountsOfAgent.mockClear()
        await service.invoke("ws-1", "transactions", {}, { ...CALLER, engine: true })
        expect(abilities.accountsOfAgent).not.toHaveBeenCalled()
    })
})
