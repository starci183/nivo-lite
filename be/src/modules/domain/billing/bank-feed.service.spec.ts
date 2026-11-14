import { receipt } from "@tests/fixtures/builders/bank-feed-receipts.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AccountDataIntakeService, type AccountWrite } from "@modules/domain/account-data"
import { BankFeedReceiptService } from "@modules/domain/bank-feed-inbox"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BankFeedTriggerService } from "./bank-feed-trigger.service"
import { BankFeedService } from "./bank-feed.service"
import { BillingError, BillingErrorCode } from "./errors/billing.error"

const MARK_CONNECTION_FED = 'SELECT * FROM "public"."connection_mark_fed"($1, $2, $3)'
const NOW = "2026-11-12T08:00:00.000Z"
const refusal = new BillingError({ code: BillingErrorCode.WebhookInvalid })
const WRITTEN: AccountWrite = { owner: receipt.owner, rows: [{ type: "casso.transaction", key: "bank:7", id: "row-1", isNew: true }] }

/**
 * The consumer with the only collaborators it has: the delivery inbox, the account's intake and the trigger. No inbound event store,
 * event bus, payment record or agent tag is provided, so a booking, an announcement or a business record could not even be wired.
 */
const build = async () => {
    const tx = fakeTransaction(mockEntityManager({ query: [MARK_CONNECTION_FED, []] }))
    const feedInbox = mock<BankFeedReceiptService>()
    feedInbox.lock.mockResolvedValue(receipt)
    const intake = mock<AccountDataIntakeService>()
    intake.write.mockResolvedValue(WRITTEN)
    const trigger = mock<BankFeedTriggerService>()
    trigger.emit.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: BankFeedReceiptService, useValue: feedInbox },
            { provide: AccountDataIntakeService, useValue: intake },
            { provide: BankFeedTriggerService, useValue: trigger },
        ],
    }).compile()
    return { feed: moduleRef.get(BankFeedService), tx, feedInbox, intake, trigger }
}

describe("BankFeedService.processRecordedFeedDelivery", () => {
    it.each([
        ["sepay-feed", "sepay.transaction"],
        ["casso", "casso.transaction"],
        ["payos", "payos.transaction"],
    ] as const)("writes every movement of a new %s delivery as a %s row and completes it in one transaction", async (provider, type) => {
        const { feed, feedInbox, intake, trigger, tx } = await build()

        await expect(feed.processRecordedFeedDelivery({ provider, deliveryId: "c-1:7" })).resolves.toBeUndefined()

        const manager = feedInbox.lock.mock.calls[0]?.[0]
        expect(feedInbox.lock).toHaveBeenCalledWith(manager, provider, "c-1:7")
        expect(intake.write).toHaveBeenCalledTimes(1)
        expect(intake.write).toHaveBeenCalledWith(manager, "c-1", [
            {
                type,
                value: { transactionId: "bank:7", amount: 125000, direction: "credit", content: "NIVO123", source: "webhook" },
            },
        ])
        expect(trigger.emit).toHaveBeenCalledWith(manager, receipt.owner, intake.write.mock.calls[0]?.[2], WRITTEN)
        expect(feedInbox.complete).toHaveBeenCalledWith(manager, receipt)
        expect(tx.commits).toBe(1)
    })

    it("marks the connection as working with its first movement, and runs no other query: nothing is booked or recorded", async () => {
        const { feed, tx } = await build()

        await feed.processRecordedFeedDelivery({ provider: "casso", deliveryId: "c-1:7" })

        expect(tx.em.query).toHaveBeenCalledTimes(1)
        expect(tx.em.query).toHaveBeenCalledWith(MARK_CONNECTION_FED, [
            "c-1",
            new Date(NOW),
            JSON.stringify({ amount: 125000, content: "NIVO123", at: NOW }),
        ])
    })

    it("does nothing for a redelivery: an absent or already completed delivery writes, marks, emits and completes nothing", async () => {
        const { feed, feedInbox, intake, trigger, tx } = await build()
        feedInbox.lock.mockResolvedValue(undefined)

        await expect(feed.processRecordedFeedDelivery({ provider: "payos", deliveryId: "c-1:7" })).resolves.toBeUndefined()

        expect(intake.write).not.toHaveBeenCalled()
        expect(tx.em.query).not.toHaveBeenCalled()
        expect(trigger.emit).not.toHaveBeenCalled()
        expect(feedInbox.complete).not.toHaveBeenCalled()
    })

    it("completes a delivery with no movements without marking the connection", async () => {
        const { feed, feedInbox, intake, tx } = await build()
        feedInbox.lock.mockResolvedValue({ ...receipt, payload: { connection: "c-1", credits: [] } })
        intake.write.mockResolvedValue({ owner: receipt.owner, rows: [] })

        await feed.processRecordedFeedDelivery({ provider: "casso", deliveryId: "c-1:7" })

        expect(tx.em.query).not.toHaveBeenCalled()
        expect(feedInbox.complete).toHaveBeenCalledTimes(1)
    })

    it("leaves the delivery pending when its movements cannot be kept", async () => {
        const { feed, feedInbox, intake, trigger, tx } = await build()
        intake.write.mockRejectedValue(refusal)

        await expect(feed.processRecordedFeedDelivery({ provider: "casso", deliveryId: "c-1:7" })).rejects.toBe(refusal)

        expect(trigger.emit).not.toHaveBeenCalled()
        expect(feedInbox.complete).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })
})
