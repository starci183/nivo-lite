import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BillingService } from "@modules/domain/billing"
import { SepayReviewService } from "./sepay-review.service"
import type { ReviewTransaction } from "./sepay-transactions.contracts"
import { SepayTransactionsService } from "./sepay-transactions.service"

const TRANSFER: ReviewTransaction = {
    id: 9001,
    status: "underpaid",
    transferAmount: 500000,
    receivedAt: "2026-10-13T02:00:00.000Z",
    content: "NIVO8F3K2",
}

const build = async () => {
    const billing = mock<BillingService>()
    const transactions = mock<SepayTransactionsService>()
    transactions.review.mockResolvedValue([TRANSFER])
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayReviewService,
            { provide: BillingService, useValue: billing },
            { provide: SepayTransactionsService, useValue: transactions },
        ],
    }).compile()
    return { reviews: moduleRef.get(SepayReviewService), billing, transactions }
}

describe("SepayReviewService", () => {
    describe("review", () => {
        it("requires a manager, then reads the transfers of the workspace orders", async () => {
            const { reviews, billing, transactions } = await build()

            await expect(reviews.review("user-1", "ws-1", ["order-1"])).resolves.toEqual([TRANSFER])
            expect(billing.requireManager).toHaveBeenCalledWith("user-1", "ws-1")
            expect(transactions.review).toHaveBeenCalledWith("ws-1", ["order-1"])
        })

        it("reads nothing for a caller who is not a manager", async () => {
            const { reviews, billing, transactions } = await build()
            const refusal = "not a manager"
            billing.requireManager.mockRejectedValue(refusal)

            await expect(reviews.review("user-1", "ws-1", ["order-1"])).rejects.toBe(refusal)
            expect(transactions.review).not.toHaveBeenCalled()
        })
    })
})
