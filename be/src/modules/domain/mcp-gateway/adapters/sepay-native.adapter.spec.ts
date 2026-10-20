import { mockEntityManager } from "@starci/jest-preset"
import { McpGatewayError } from "../errors/mcp-gateway.error"
import { LIST_BANK_TRANSACTIONS } from "../persistence/sepay-native.sql"
import { SepayNativeAdapter } from "./sepay-native.adapter"

describe("SepayNativeAdapter", () => {
    it("lists the workspace's bank credits with bounded filters", async () => {
        const entityManager = mockEntityManager()
        entityManager.query.mockResolvedValue([
            {
                id: "t1",
                amount_vnd: "500000",
                reference: "HK302",
                payer: "LAN",
                status: "unmatched",
                occurred_at: new Date("2026-10-20T01:00:00Z"),
            },
            {
                id: "t2",
                amount_vnd: 1000,
                reference: null,
                payer: null,
                status: "matched",
                occurred_at: "2026-10-19T00:00:00Z",
            },
        ])
        const adapter = new SepayNativeAdapter(entityManager)
        await expect(
            adapter.invoke("ws", "transactions.list", { status: "unmatched", since: "2026-10-19", limit: 500 }),
        ).resolves.toEqual({
            transactions: [
                {
                    id: "t1",
                    amountVnd: 500000,
                    reference: "HK302",
                    payer: "LAN",
                    status: "unmatched",
                    occurredAt: "2026-10-20T01:00:00.000Z",
                },
                {
                    id: "t2",
                    amountVnd: 1000,
                    reference: null,
                    payer: null,
                    status: "matched",
                    occurredAt: "2026-10-19T00:00:00Z",
                },
            ],
        })
        expect(entityManager.query).toHaveBeenCalledWith(LIST_BANK_TRANSACTIONS, [
            "ws",
            "unmatched",
            "2026-10-19T00:00:00.000Z",
            50,
        ])
        await adapter.invoke("ws", "transactions.list", { status: "x", since: "nope", limit: 0 })
        await adapter.invoke("ws", "transactions.list", { limit: 2.5 })
        expect(entityManager.query.mock.calls.slice(1).map((call) => call[1])).toEqual([
            ["ws", null, null, 1],
            ["ws", null, null, 20],
        ])
    })

    it("refuses a tool it does not have", async () => {
        await expect(
            new SepayNativeAdapter(mockEntityManager()).invoke("ws", "payouts.send", {}),
        ).rejects.toBeInstanceOf(McpGatewayError)
    })
})
