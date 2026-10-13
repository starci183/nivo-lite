import type { RawBodyRequest } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { SepayTransactionsService } from "@modules/domain/sepay-transactions"
import { SepayWebhook } from "./sepay.webhook"

const RAW = Buffer.from(JSON.stringify({ id: 9001 }))

const build = async () => {
    const settlement = mock<SepayTransactionsService>()
    settlement.acceptSepayDelivery.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        controllers: [SepayWebhook],
        providers: [{ provide: SepayTransactionsService, useValue: settlement }],
    }).compile()
    return { door: moduleRef.get(SepayWebhook), settlement }
}

describe("SepayWebhook", () => {
    it("hands the key header and the exact raw bytes to the settlement and answers success", async () => {
        const { door, settlement } = await build()

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "Apikey k")).resolves.toEqual({
            success: true,
        })

        expect(settlement.acceptSepayDelivery).toHaveBeenCalledWith({ authorization: "Apikey k", rawBody: RAW })
    })

    it("lets a refusal or a failure of the settlement reach SePay so it retries", async () => {
        const { door, settlement } = await build()
        const failure = "refused"
        settlement.acceptSepayDelivery.mockRejectedValue(failure)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), undefined)).rejects.toBe(failure)
    })
})
