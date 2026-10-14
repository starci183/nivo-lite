import { HttpStatus } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import { HTTP_CODE_METADATA } from "@nestjs/common/constants"
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
    it.each(["Apikey k", " \tAPIKEY k \t"])(
        "hands the header %j and the exact raw bytes to the settlement and answers success",
        async (authorization) => {
            const { door, settlement } = await build()

            await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), authorization)).resolves.toEqual(
                {
                    success: true,
                },
            )

            expect(settlement.acceptSepayDelivery).toHaveBeenCalledTimes(1)
            expect(settlement.acceptSepayDelivery).toHaveBeenCalledWith({ authorization, rawBody: RAW })
            expect(settlement.acceptSepayDelivery.mock.calls[0]?.[0].rawBody).toBe(RAW)
        },
    )

    it("answers success again when SePay repeats an accepted delivery", async () => {
        const { door, settlement } = await build()
        const request = mock<RawBodyRequest<Request>>({ rawBody: RAW })

        await expect(door.receive(request, "Apikey k")).resolves.toEqual({ success: true })
        await expect(door.receive(request, "Apikey k")).resolves.toEqual({ success: true })

        expect(settlement.acceptSepayDelivery).toHaveBeenCalledTimes(2)
        expect(settlement.acceptSepayDelivery).toHaveBeenNthCalledWith(1, { authorization: "Apikey k", rawBody: RAW })
        expect(settlement.acceptSepayDelivery).toHaveBeenNthCalledWith(2, { authorization: "Apikey k", rawBody: RAW })
    })

    it("lets a refusal or a failure of the settlement reach SePay so it retries", async () => {
        const { door, settlement } = await build()
        const failure = "refused"
        settlement.acceptSepayDelivery.mockRejectedValue(failure)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), undefined)).rejects.toBe(failure)

        expect(settlement.acceptSepayDelivery).toHaveBeenCalledTimes(1)
        expect(settlement.acceptSepayDelivery).toHaveBeenCalledWith({ authorization: undefined, rawBody: RAW })
    })

    it("acknowledges accepted deliveries with HTTP 200", () => {
        expect(Reflect.getMetadata(HTTP_CODE_METADATA, SepayWebhook.prototype.receive)).toBe(HttpStatus.OK)
    })
})
