import type { RawBodyRequest } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { BankFeedService } from "@modules/domain/billing"
import { CassoWebhook } from "./casso.webhook"

const RAW = Buffer.from(JSON.stringify({ error: 0 }))

const build = async () => {
    const feed = mock<BankFeedService>()
    feed.acceptCassoDelivery.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        controllers: [CassoWebhook],
        providers: [{ provide: BankFeedService, useValue: feed }],
    }).compile()
    return { door: moduleRef.get(CassoWebhook), feed }
}

describe("CassoWebhook", () => {
    it("hands the url connection, the raw bytes and both proof headers to the feed intake", async () => {
        const { door, feed } = await build()

        await door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", "t=1,v1=ab", "token")

        expect(feed.acceptCassoDelivery).toHaveBeenCalledWith({
            connectionId: "conn-1",
            rawBody: RAW,
            signature: "t=1,v1=ab",
            secureToken: "token",
        })
    })

    it("lets a refusal of the intake reach Casso", async () => {
        const { door, feed } = await build()
        const refusal = "refused"
        feed.acceptCassoDelivery.mockRejectedValue(refusal)

        await expect(
            door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", undefined, undefined),
        ).rejects.toBe(refusal)
    })
})
