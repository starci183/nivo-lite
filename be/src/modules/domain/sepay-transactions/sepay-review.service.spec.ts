import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BillingService } from "@modules/domain/billing"
import { SepayReviewService } from "./sepay-review.service"
import { SepayTransactionsService } from "./sepay-transactions.service"
import type { ReviewTransaction } from "./sepay-transactions.contracts"

const REVIEW: ReviewTransaction = {
    id: 9001,
    status: "unmatched",
    transferAmount: 990000,
    receivedAt: "2026-10-12T10:00:00.000Z",
    content: "nivo 8f3k2 chuyen tien",
}

const build = async () => {
    const billing = mock<BillingService>()
    const transactions = mock<SepayTransactionsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayReviewService,
            { provide: BillingService, useValue: billing },
            { provide: SepayTransactionsService, useValue: transactions },
        ],
    }).compile()
    return { review: moduleRef.get(SepayReviewService), billing, transactions }
}

describe("SepayReviewService", () => {
    it("returns the transfers of a manager's workspace after proving the role", async () => {
        const { review, billing, transactions } = await build()
        transactions.review.mockResolvedValue([REVIEW])

        await expect(review.review("user-1", "ws-1", ["order-1"])).resolves.toEqual([REVIEW])

        expect(billing.requireManager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(transactions.review).toHaveBeenCalledWith("ws-1", ["order-1"])
    })
})
