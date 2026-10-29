import { Test } from "@nestjs/testing"
import { fakeInbox, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { BankCreditSettlementService } from "./bank-credit-settlement.service"
import { ReconcilePaymentPerformerService } from "./reconcile-payment-performer.service"
import { itemOf } from "@tests/fixtures/builders/reconcile-payment-performer.builder"

const QUEUE = "bank_credit_booked__accounting"
const credit = { dedupeKey: "ev-1", workspaceId: "ws-1", inboundEventId: "ev-1", amountVnd: 450000 }

/** The settlement over doubles of its three dependencies; the matching itself is the reconcile performer's own spec. */
const build = async () => {
    const reconcile = mock<ReconcilePaymentPerformerService>()
    const engine = mock<WorkEngineService>()
    engine.startInboundWork.mockResolvedValue(itemOf({ status: "done" }))
    const inbound = mock<InboundEventsService>()
    const tx = fakeTransaction(mockEntityManager())
    const inbox = fakeInbox()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankCreditSettlementService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: INBOX, useValue: inbox },
            { provide: ReconcilePaymentPerformerService, useValue: reconcile },
            { provide: WorkEngineService, useValue: engine },
            { provide: InboundEventsService, useValue: inbound },
        ],
    }).compile()
    return { settlement: moduleRef.get(BankCreditSettlementService), reconcile, engine, inbound, tx, inbox }
}

describe("BankCreditSettlementService settle", () => {
    it("reconciles by itself a credit that clearly matches one issued invoice", async () => {
        const { settlement, reconcile, engine, inbound } = await build()
        reconcile.clearlyMatches.mockResolvedValue(true)

        await expect(settlement.settle(QUEUE, credit.dedupeKey, credit)).resolves.toBeUndefined()

        expect(reconcile.clearlyMatches).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "NIVO", locale: "vi" },
            "ev-1",
        )
        expect(engine.startInboundWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "NIVO", locale: "vi" },
            { id: "ev-1" },
            "reconcile_payment",
            { amount_vnd: 450000 },
            null,
        )
        expect(inbound.holdForOwnerCheck).not.toHaveBeenCalled()
    })

    it("holds a credit that does not clearly match for the owner's check", async () => {
        const { settlement, reconcile, engine, inbound } = await build()
        reconcile.clearlyMatches.mockResolvedValue(false)

        await expect(settlement.settle(QUEUE, credit.dedupeKey, credit)).resolves.toBeUndefined()

        expect(engine.startInboundWork).not.toHaveBeenCalled()
        expect(inbound.holdForOwnerCheck).toHaveBeenCalledWith("ev-1", expect.anything())
    })

    it("pays once for a credit delivered twice: the second delivery key is already claimed", async () => {
        const { settlement, reconcile, engine, inbound, inbox } = await build()
        reconcile.clearlyMatches.mockResolvedValue(true)

        await settlement.settle(QUEUE, credit.dedupeKey, credit)
        await settlement.settle(QUEUE, credit.dedupeKey, credit)

        expect(inbox.claims).toEqual([
            { source: QUEUE, eventId: "ev-1" },
            { source: QUEUE, eventId: "ev-1" },
        ])
        expect(engine.startInboundWork).toHaveBeenCalledTimes(1)
        expect(inbound.holdForOwnerCheck).not.toHaveBeenCalled()
    })

    it("claims the delivery key in the transaction of the hold and releases it when the effect fails", async () => {
        const { settlement, reconcile, inbound, tx } = await build()
        const failure = new Error("hold failed")
        reconcile.clearlyMatches.mockResolvedValue(false)
        inbound.holdForOwnerCheck.mockRejectedValue(failure)

        await expect(settlement.settle(QUEUE, credit.dedupeKey, credit)).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
    })
})
