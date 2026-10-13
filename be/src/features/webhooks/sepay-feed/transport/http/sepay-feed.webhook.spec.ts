import type { RawBodyRequest } from "@nestjs/common"
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
    it("hands the url connection, the key header and the raw bytes to the feed intake and answers success", async () => {
        const { door, feed } = await build()

        await expect(
            door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", "Apikey k"),
        ).resolves.toEqual({ success: true })

        expect(feed.acceptSepayFeedDelivery).toHaveBeenCalledWith({
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
    })
})
