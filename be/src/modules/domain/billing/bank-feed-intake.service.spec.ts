import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PollScheduleService } from "@modules/domain/connection-poll"
import { BankFeedIntakeService } from "./bank-feed-intake.service"
import { BankFeedReceiptsService } from "./bank-feed-receipts.service"
import { BillingError, BillingErrorCode } from "./errors/billing.error"

const RAW = Buffer.from(JSON.stringify({ id: 3 }))

const build = async () => {
    const feed = mock<BankFeedReceiptsService>()
    feed.acceptFeedDelivery.mockResolvedValue(undefined)
    const schedule = mock<PollScheduleService>()
    schedule.recordWebhook.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedIntakeService,
            { provide: BankFeedReceiptsService, useValue: feed },
            { provide: PollScheduleService, useValue: schedule },
        ],
    }).compile()
    return { intake: moduleRef.get(BankFeedIntakeService), feed, schedule }
}

describe("BankFeedIntakeService acceptDelivery", () => {
    it("records the receipt, then marks the connection's webhook as delivered", async () => {
        const { intake, feed, schedule } = await build()

        await expect(intake.acceptDelivery(RAW, "conn-1", "sepay")).resolves.toBeUndefined()

        expect(feed.acceptFeedDelivery).toHaveBeenCalledTimes(1)
        expect(feed.acceptFeedDelivery).toHaveBeenCalledWith(RAW, "conn-1", "sepay")
        expect(schedule.recordWebhook).toHaveBeenCalledTimes(1)
        expect(schedule.recordWebhook).toHaveBeenCalledWith("conn-1")
    })

    it("leaves the schedule untouched when the receipt is refused", async () => {
        const { intake, feed, schedule } = await build()
        const refusal = new BillingError({ code: BillingErrorCode.WebhookInvalid })
        feed.acceptFeedDelivery.mockRejectedValue(refusal)

        await expect(intake.acceptDelivery(RAW, "conn-1", "sepay")).rejects.toBe(refusal)

        expect(schedule.recordWebhook).not.toHaveBeenCalled()
    })
})
