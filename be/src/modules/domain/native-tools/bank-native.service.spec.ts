import { mock } from "@starci/jest-preset"
import { ConnectionBindingsReadService, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord, ConnectionStatusFacts } from "@modules/domain/connections"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { BankTransactionsRegistry } from "@modules/domain/provider-registry"
import type { BankTransaction } from "@modules/domain/provider-registry"
import { BANK_MANIFEST, BankNativeService } from "./bank-native.service"
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

const build = () => {
    const views = mock<NativeViewService>()
    views.internalOf.mockResolvedValue(undefined as never)
    const bindings = mock<ConnectionBindingsReadService>()
    const connections = mock<ConnectionsService>()
    const providers = new BankTransactionsRegistry()
    const transactions = jest.fn().mockResolvedValue([TRANSACTION])
    providers.register({ provider: "sepay", transactions })
    return {
        service: new BankNativeService(views, bindings, connections, providers),
        views,
        bindings,
        connections,
        transactions,
    }
}

describe("BankNativeService", () => {
    it("announces one internal read tool named by the capability", () => {
        expect(BANK_MANIFEST.key).toBe("bank")
        expect(BANK_MANIFEST.tools[0]).toMatchObject({ name: "transactions", scope: "read", internalOnly: true })
    })

    it("lists the transactions of the live feed through the provider that registered, with the window the caller named", async () => {
        const { service, views, bindings, connections, transactions } = build()
        bindings.ofProvider.mockResolvedValue([feed("connected")])
        connections.find.mockResolvedValue(record("live"))

        const answer = await service.invoke(
            "ws-1",
            "transactions",
            { since: "2026-11-01T00:00:00.000Z", until: "2026-11-04T00:00:00.000Z", limit: 5 },
            CALLER,
        )

        expect(views.internalOf).toHaveBeenCalledWith("ws-1", CALLER)
        expect(answer).toEqual({ provider: "sepay", transactions: [TRANSACTION] })
        expect(transactions).toHaveBeenCalledWith(record("live"), {
            since: new Date("2026-11-01T00:00:00.000Z"),
            until: new Date("2026-11-04T00:00:00.000Z"),
            limit: 5,
        })
    })

    it("passes no window when the caller names none and defaults the limit", async () => {
        const { service, bindings, connections, transactions } = build()
        bindings.ofProvider.mockResolvedValue([feed("connected")])
        connections.find.mockResolvedValue(record("live"))

        await service.invoke("ws-1", "transactions", {}, CALLER)

        expect(transactions).toHaveBeenCalledWith(record("live"), { since: undefined, until: undefined, limit: 20 })
    })

    it.each([
        ["no feed", []],
        ["only a disconnected feed", [feed("disconnected")]],
    ])("is not connected with %s", async (_name, feeds) => {
        const { service, bindings } = build()
        bindings.ofProvider.mockResolvedValue(feeds)

        await expect(service.invoke("ws-1", "transactions", {}, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
    })

    it("is not connected when the feed runs in test, vanished or cannot be read yet", async () => {
        const { service, bindings, connections, transactions } = build()
        bindings.ofProvider.mockResolvedValue([feed("connected")])
        const cases: Array<ConnectionRecord | null> = [record("test"), null]

        for (const found of cases) {
            connections.find.mockResolvedValueOnce(found)
            await expect(service.invoke("ws-1", "transactions", {}, CALLER)).rejects.toMatchObject({
                params: { reason: "not_connected" },
            })
        }
        connections.find.mockResolvedValueOnce(record("live"))
        transactions.mockResolvedValueOnce(undefined)
        await expect(service.invoke("ws-1", "transactions", {}, CALLER)).rejects.toMatchObject({
            params: { reason: "not_connected" },
        })
    })

    it("refuses arguments outside the schema and tools it does not have", async () => {
        const { service } = build()

        await expect(service.invoke("ws-1", "transactions", { limit: 0 }, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
        })
        await expect(service.invoke("ws-1", "other", {}, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
        })
    })
})
