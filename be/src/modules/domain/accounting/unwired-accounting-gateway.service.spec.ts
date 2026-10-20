import { Test } from "@nestjs/testing"
import { UnwiredAccountingGatewayService } from "./unwired-accounting-gateway.service"

describe("UnwiredAccountingGatewayService", () => {
    it("knows no invoice, no credit, no folio and records nothing", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [UnwiredAccountingGatewayService] }).compile()
        const gateway = moduleRef.get(UnwiredAccountingGatewayService)

        await expect(gateway.listEinvoices()).resolves.toEqual([])
        await expect(gateway.listBankCredits()).resolves.toEqual([])
        await expect(gateway.listOpenPayables()).resolves.toEqual([])
        await expect(gateway.findByTransferRef()).resolves.toBeNull()
        await expect(gateway.recordPayment()).resolves.toBe(false)
    })
})
