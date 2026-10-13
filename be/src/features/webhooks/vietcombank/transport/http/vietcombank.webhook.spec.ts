import type { RawBodyRequest } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { BankFeedService } from "@modules/domain/billing"
import { VietcombankWebhook } from "./vietcombank.webhook"

const RAW = Buffer.from(JSON.stringify({ amount_vnd: 1 }))

const build = async () => {
    const feed = mock<BankFeedService>()
    feed.acceptSimulatedCredit.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        controllers: [VietcombankWebhook],
        providers: [{ provide: BankFeedService, useValue: feed }],
    }).compile()
    return { door: moduleRef.get(VietcombankWebhook), feed }
}

describe("VietcombankWebhook", () => {
    it("hands the shared secret header and the raw bytes to the feed intake", async () => {
        const { door, feed } = await build()

        await door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "bank-secret")

        expect(feed.acceptSimulatedCredit).toHaveBeenCalledWith({ secret: "bank-secret", rawBody: RAW })
    })

    it("lets a refusal of the intake reach the caller", async () => {
        const { door, feed } = await build()
        const refusal = "refused"
        feed.acceptSimulatedCredit.mockRejectedValue(refusal)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), undefined)).rejects.toBe(refusal)
    })
})
