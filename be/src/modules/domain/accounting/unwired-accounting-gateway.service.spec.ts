import { Test } from "@nestjs/testing"
import { UnwiredAccountingGatewayService } from "./unwired-accounting-gateway.service"

describe("UnwiredAccountingGatewayService", () => {
    it("has no tool for any role: no invoice, no credit, no receivable and nothing recorded", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [UnwiredAccountingGatewayService] }).compile()
        const gateway = moduleRef.get(UnwiredAccountingGatewayService)

        await expect(gateway.listEinvoices()).resolves.toEqual({ tool: null, value: [] })
        await expect(gateway.listPaymentCredits()).resolves.toEqual({ tool: null, value: [] })
        await expect(gateway.listPaymentDebits()).resolves.toEqual({ tool: null, value: [] })
        await expect(gateway.listOpenPayables()).resolves.toEqual([])
        await expect(gateway.findReceivable()).resolves.toEqual({ tool: null, value: null })
        await expect(gateway.recordPayment()).resolves.toBe(false)
        await expect(gateway.creditsSource()).resolves.toBeNull()
        await expect(gateway.payablesSource()).resolves.toBeNull()
        await expect(gateway.connections()).resolves.toEqual({ invoices: false, receivables: false })
    })
})
