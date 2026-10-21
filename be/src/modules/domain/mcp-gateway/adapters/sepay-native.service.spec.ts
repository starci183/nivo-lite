import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TransactionsService } from "@modules/domain/transactions"
import type { BankCreditRow } from "@modules/domain/transactions"
import { McpGatewayErrorCode } from "../errors/mcp-gateway.error"
import { SEPAY_MANIFEST, SepayNativeService } from "./sepay-native.service"

const CREDIT: BankCreditRow = {
    id: "tx-1",
    amount_vnd: 3600000,
    reference: "HAKUEN F7K2Q9",
    payer: "NGUYEN VAN A",
    status: "unmatched",
    occurred_at: "2026-10-20T02:00:00.000Z",
}

const build = async () => {
    const transactions = mock<TransactionsService>()
    transactions.listBankCredits.mockResolvedValue([CREDIT])
    transactions.listBankDebits.mockResolvedValue([{ ...CREDIT, id: "tx-2", payer: "SUPPLIER CO" }])
    const moduleRef = await Test.createTestingModule({
        providers: [SepayNativeService, { provide: TransactionsService, useValue: transactions }],
    }).compile()
    return { sepay: moduleRef.get(SepayNativeService), transactions }
}

describe("SepayNativeService", () => {
    it("declares the sepay manifest", async () => {
        const { sepay } = await build()

        expect(sepay.manifest).toBe(SEPAY_MANIFEST)
        expect(SEPAY_MANIFEST.tools.map((tool) => [tool.name, tool.role])).toEqual([
            ["transactions.list", "payment.credits.list"],
            ["transactions.debits", "payment.debits.list"],
        ])
    })

    it("lists the bank credits through the transactions owner with the given filters", async () => {
        const { sepay, transactions } = await build()

        await expect(
            sepay.invoke("ws-1", "transactions.list", {
                status: "unmatched",
                since: "2026-10-01T07:00:00+07:00",
                limit: 5,
            }),
        ).resolves.toEqual({
            transactions: [
                {
                    id: "tx-1",
                    amountVnd: 3600000,
                    reference: "HAKUEN F7K2Q9",
                    payer: "NGUYEN VAN A",
                    status: "unmatched",
                    occurredAt: "2026-10-20T02:00:00.000Z",
                },
            ],
        })
        expect(transactions.listBankCredits).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            status: "unmatched",
            since: "2026-10-01T00:00:00.000Z",
            limit: 5,
        })
    })

    it("drops a filter it cannot read and bounds the limit", async () => {
        const { sepay, transactions } = await build()

        await sepay.invoke("ws-1", "transactions.list", { status: "lost", since: "yesterday", limit: 500 })
        await sepay.invoke("ws-1", "transactions.list", { status: 3, since: 7, limit: 0 })
        await sepay.invoke("ws-1", "transactions.list", { limit: 2.5 })

        expect(transactions.listBankCredits.mock.calls).toEqual([
            [{ workspaceId: "ws-1", status: null, since: null, limit: 50 }],
            [{ workspaceId: "ws-1", status: null, since: null, limit: 1 }],
            [{ workspaceId: "ws-1", status: null, since: null, limit: 20 }],
        ])
    })

    it("lists the bank debits through the transactions owner with the same filters", async () => {
        const { sepay, transactions } = await build()

        await expect(sepay.invoke("ws-1", "transactions.debits", { limit: 3 })).resolves.toMatchObject({
            transactions: [{ id: "tx-2", payer: "SUPPLIER CO", amountVnd: 3600000 }],
        })
        expect(transactions.listBankDebits).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            status: null,
            since: null,
            limit: 3,
        })
        expect(transactions.listBankCredits).not.toHaveBeenCalled()
    })

    it("refuses a tool the connector does not have", async () => {
        const { sepay, transactions } = await build()

        await expect(sepay.invoke("ws-1", "transactions.delete", {})).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
            params: { tool: "transactions.delete" },
        })
        expect(transactions.listBankCredits).not.toHaveBeenCalled()
    })
})
