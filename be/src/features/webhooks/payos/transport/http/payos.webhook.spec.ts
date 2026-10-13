import type { RawBodyRequest } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { BankFeedService } from "@modules/domain/billing"
import { PayosWebhook } from "./payos.webhook"

const RAW = Buffer.from(JSON.stringify({ code: "00" }))

const build = async () => {
    const feed = mock<BankFeedService>()
    feed.acceptPayosDelivery.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        controllers: [PayosWebhook],
        providers: [{ provide: BankFeedService, useValue: feed }],
    }).compile()
    return { door: moduleRef.get(PayosWebhook), feed }
}

describe("PayosWebhook", () => {
    it("hands the url connection and the raw bytes to the feed intake", async () => {
        const { door, feed } = await build()

        await door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1")

        expect(feed.acceptPayosDelivery).toHaveBeenCalledWith({ connectionId: "conn-1", rawBody: RAW })
    })

    it("lets a refusal of the intake reach payOS", async () => {
        const { door, feed } = await build()
        const refusal = "refused"
        feed.acceptPayosDelivery.mockRejectedValue(refusal)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1")).rejects.toBe(refusal)
    })
})
