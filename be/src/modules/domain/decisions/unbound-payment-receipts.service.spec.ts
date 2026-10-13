import { Test } from "@nestjs/testing"
import { UnboundPaymentReceiptsService } from "./unbound-payment-receipts.service"

describe("UnboundPaymentReceiptsService", () => {
    it("triggers no payment receipt", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [UnboundPaymentReceiptsService],
        }).compile()
        const subject = moduleRef.get(UnboundPaymentReceiptsService)

        await expect(subject.receiptFor()).resolves.toBeUndefined()
    })
})
