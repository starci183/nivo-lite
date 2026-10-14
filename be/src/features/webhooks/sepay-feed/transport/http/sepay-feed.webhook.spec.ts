import { HttpStatus } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import { HTTP_CODE_METADATA } from "@nestjs/common/constants"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { BankFeedService } from "@modules/domain/billing"
import { SepayFeedWebhook } from "./sepay-feed.webhook"

const RAW = Buffer.from(JSON.stringify({ id: 3 }))

const build = async () => {
    const feed = mock<BankFeedService>()
    feed.acceptSepayFeedDelivery.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        controllers: [SepayFeedWebhook],
        providers: [{ provide: BankFeedService, useValue: feed }],
    }).compile()
    return { door: moduleRef.get(SepayFeedWebhook), feed }
}

describe("SepayFeedWebhook", () => {
    it.each(["Apikey k", " \tAPIKEY k \t"])(
        "hands the url connection, the header %j and the raw bytes to the feed intake and answers success",
        async (authorization) => {
            const { door, feed } = await build()

            await expect(
                door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", authorization),
            ).resolves.toEqual({ success: true })

            expect(feed.acceptSepayFeedDelivery).toHaveBeenCalledTimes(1)
            expect(feed.acceptSepayFeedDelivery).toHaveBeenCalledWith({
                connectionId: "conn-1",
                authorization,
                rawBody: RAW,
            })
            expect(feed.acceptSepayFeedDelivery.mock.calls[0]?.[0].rawBody).toBe(RAW)
        },
    )

    it("answers success again when SePay repeats an accepted delivery", async () => {
        const { door, feed } = await build()
        const request = mock<RawBodyRequest<Request>>({ rawBody: RAW })

        await expect(door.receive(request, "conn-1", "Apikey k")).resolves.toEqual({ success: true })
        await expect(door.receive(request, "conn-1", "Apikey k")).resolves.toEqual({ success: true })

        expect(feed.acceptSepayFeedDelivery).toHaveBeenCalledTimes(2)
        expect(feed.acceptSepayFeedDelivery).toHaveBeenNthCalledWith(1, {
            connectionId: "conn-1",
            authorization: "Apikey k",
            rawBody: RAW,
        })
        expect(feed.acceptSepayFeedDelivery).toHaveBeenNthCalledWith(2, {
            connectionId: "conn-1",
            authorization: "Apikey k",
            rawBody: RAW,
        })
    })

    it("lets a refusal of the intake reach SePay", async () => {
        const { door, feed } = await build()
        const refusal = "refused"
        feed.acceptSepayFeedDelivery.mockRejectedValue(refusal)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", undefined)).rejects.toBe(
            refusal,
        )

        expect(feed.acceptSepayFeedDelivery).toHaveBeenCalledTimes(1)
        expect(feed.acceptSepayFeedDelivery).toHaveBeenCalledWith({
            connectionId: "conn-1",
            authorization: undefined,
            rawBody: RAW,
        })
    })

    it("acknowledges accepted deliveries with HTTP 200", () => {
        expect(Reflect.getMetadata(HTTP_CODE_METADATA, SepayFeedWebhook.prototype.receive)).toBe(HttpStatus.OK)
    })
})
