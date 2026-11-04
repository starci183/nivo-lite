import { Test } from "@nestjs/testing"
import { SepayPaymentInstructionService } from "./sepay-payment-instruction.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [SepayPaymentInstructionService] }).compile()
    return moduleRef.get(SepayPaymentInstructionService)
}

describe("SepayPaymentInstructionService", () => {
    it("draws the SePay QR with the amount and the transfer content fixed", async () => {
        const service = await build()

        expect(
            service.qrUrl(
                { accountNumber: "525209999", bankCode: "MB" },
                { orderNo: "DH-7", amountVnd: 5000, transferContent: "DH7 thanh toan" },
            ),
        ).toBe("https://qr.sepay.vn/img?acc=525209999&bank=MB&amount=5000&des=DH7+thanh+toan&template=compact")
    })

    it("answers for the sepay provider key", async () => {
        expect((await build()).provider).toBe("sepay")
    })
})
