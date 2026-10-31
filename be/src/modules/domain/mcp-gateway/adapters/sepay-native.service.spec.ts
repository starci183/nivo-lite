import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TransactionsService } from "@modules/domain/transactions"
import type { BankCreditRow } from "@modules/domain/transactions"
import { summaryOf } from "../audit-mask.policy"
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

describe("SepayNativeService manifest", () => {
    it("declares the sepay manifest", async () => {
        const { sepay } = await build()

        expect(sepay.manifest).toBe(SEPAY_MANIFEST)
        expect(SEPAY_MANIFEST.tools.map((tool) => [tool.name, tool.role])).toEqual([
            ["transactions.list", "payment.credits.list"],
            ["transactions.debits", "payment.debits.list"],
        ])
        for (const tool of SEPAY_MANIFEST.tools) {
            expect(tool.inputSchema).toMatchObject({
                properties: {
                    status: { type: "string", enum: ["unmatched", "matched", "needs_review"] },
                    since: { type: "string", minLength: 20, maxLength: 40, format: "date-time" },
                    limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
                },
                additionalProperties: false,
            })
        }
    })
})

describe("SepayNativeService audit", () => {
    it("declares the payer and the memo as masked on both bank tools", () => {
        for (const tool of SEPAY_MANIFEST.tools) expect(tool.secretFields).toEqual(["payer", "reference"])
    })

    it("keeps the payer and the memo out of the summary the audit stores while the answer is unchanged", async () => {
        const { sepay } = await build()

        const answer = await sepay.invoke("ws-1", "transactions.list", {})
        const summary = summaryOf(answer, SEPAY_MANIFEST.tools[0]?.secretFields)

        expect(answer).toMatchObject({ transactions: [{ payer: "NGUYEN VAN A", reference: "HAKUEN F7K2Q9" }] })
        expect(summary).not.toContain("NGUYEN VAN A")
        expect(summary).not.toContain("HAKUEN F7K2Q9")
        expect(summary).toContain('"payer":"***"')
        expect(summary).toContain('"amountVnd":3600000')
    })
})

describe("SepayNativeService credits", () => {
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

    it("uses the default limit when filters are absent", async () => {
        const { sepay, transactions } = await build()

        await sepay.invoke("ws-1", "transactions.list", {})

        expect(transactions.listBankCredits.mock.calls).toEqual([
            [{ workspaceId: "ws-1", status: null, since: null, limit: 20 }],
        ])
    })
})

describe("SepayNativeService invalid arguments", () => {
    it.each(["transactions.list", "transactions.debits"])(
        "refuses invalid filters for %s before reading transactions",
        async (tool) => {
            const { sepay, transactions } = await build()

            await expect(sepay.invoke("ws-1", tool, { limit: 51 })).rejects.toMatchObject({
                code: McpGatewayErrorCode.InvalidArguments,
                params: { tool },
            })
            await expect(sepay.invoke("ws-1", tool, { status: 3 })).rejects.toMatchObject({
                code: McpGatewayErrorCode.InvalidArguments,
            })
            expect(transactions.listBankCredits).not.toHaveBeenCalled()
            expect(transactions.listBankDebits).not.toHaveBeenCalled()
        },
    )
})

describe("SepayNativeService debits", () => {
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
})

describe("SepayNativeService unknown tools", () => {
    it("refuses a tool the connector does not have", async () => {
        const { sepay, transactions } = await build()

        await expect(sepay.invoke("ws-1", "transactions.delete", {})).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
            params: { tool: "transactions.delete" },
        })
        expect(transactions.listBankCredits).not.toHaveBeenCalled()
    })
})
