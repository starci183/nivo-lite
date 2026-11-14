import { Test } from "@nestjs/testing"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ProviderRegistryError, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
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
        ).toBe("https://vietqr.app/img?acc=525209999&bank=MB&amount=5000&des=DH7%20thanh%20toan&template=compact")
    })

    it("answers for the sepay provider key", async () => {
        expect((await build()).provider).toBe("sepay")
    })

    describe("transfer (the generic tool's instruction)", () => {
        const account = (meta: Record<string, string>): ConnectionRecord =>
            connectionRecord({ id: "c-1", workspaceId: "w-1", provider: "sepay", meta })

        it("answers the connection's own receiving details and the QR link with the amount and the content fixed", async () => {
            const service = await build()
            await expect(
                service.transfer(
                    account({ account_number: "525209999", bank_code: "MB", account_holder: "TIEM HOA" }),
                    { amountVnd: 150000, content: "DH001" },
                ),
            ).resolves.toEqual({
                qrImageUrl: "https://vietqr.app/img?acc=525209999&bank=MB&amount=150000&des=DH001&template=compact",
                bankCode: "MB",
                accountNumber: "525209999",
                accountHolder: "TIEM HOA",
                content: "DH001",
                amountVnd: 150000,
            })
        })

        it("leaves the holder out when the connection holds none", async () => {
            const service = await build()
            const answer = await service.transfer(account({ account_number: "1", bank_code: "VCB" }), { amountVnd: 1000, content: "A" })
            expect("accountHolder" in answer).toBe(false)
        })

        it.each([[{ bank_code: "MB" }], [{ account_number: "1" }], [{}]])("refuses an account without number or bank code (%j)", async (meta) => {
            const service = await build()
            await expect(service.transfer(account(meta), { amountVnd: 1000, content: "A" })).rejects.toEqual(
                expect.objectContaining({ code: ProviderRegistryErrorCode.RefusedNoCredential }),
            )
            await expect(service.transfer(account(meta), { amountVnd: 1000, content: "A" })).rejects.toBeInstanceOf(ProviderRegistryError)
        })
    })
})
