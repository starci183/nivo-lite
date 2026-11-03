import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PaymentClaimGraphAdapter } from "./payment-claim-graph.adapter"
import { PaymentClaimWorkRaisedAdapter } from "./payment-claim-work-raised.adapter"

describe("PaymentClaimWorkRaisedAdapter", () => {
    it("escalates the claim a raised work item answers, and tolerates a claim that was no longer open", async () => {
        const claims = mock<PaymentClaimGraphAdapter>()
        claims.escalate.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        const moduleRef = await Test.createTestingModule({
            providers: [PaymentClaimWorkRaisedAdapter, { provide: PaymentClaimGraphAdapter, useValue: claims }],
        }).compile()
        const hook = moduleRef.get(PaymentClaimWorkRaisedAdapter)

        await expect(hook.raised("ws-1", "claim-dinh", "item-1")).resolves.toBeUndefined()
        await expect(hook.raised("ws-1", "claim-dinh", "item-2")).resolves.toBeUndefined()

        expect(claims.escalate).toHaveBeenCalledTimes(2)
        expect(claims.escalate).toHaveBeenCalledWith("ws-1", "claim-dinh")
    })
})
