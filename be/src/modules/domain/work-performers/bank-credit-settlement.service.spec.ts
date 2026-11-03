import { Test } from "@nestjs/testing"
import { fakeInbox, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { InboundEventDetail } from "@modules/domain/inbound-events"
import type { Outcome } from "@nivo-lite/agent-sdk/reconcile"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { BankCreditSettlementService } from "./bank-credit-settlement.service"
import { OrderPaymentReconcileService } from "./order-payment-reconcile.service"
import { ReconcilePaymentPerformerService } from "./reconcile-payment-performer.service"
import { itemOf } from "@tests/fixtures/builders/reconcile-payment-performer.builder"

const QUEUE = "bank_credit_booked__accounting"
const credit = { dedupeKey: "ev-1", workspaceId: "ws-1", inboundEventId: "ev-1", amountVnd: 450000 }

/** The settlement over doubles of its dependencies; the matching itself is the reconcile performer's own spec. */
const build = async () => {
    const reconcile = mock<ReconcilePaymentPerformerService>()
    const engine = mock<WorkEngineService>()
    engine.startInboundWork.mockResolvedValue(itemOf({ status: "done" }))
    const inbound = mock<InboundEventsService>()
    inbound.find.mockResolvedValue(null)
    const orderPayments = mock<OrderPaymentReconcileService>()
    orderPayments.plan.mockResolvedValue(null)
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
            { provide: OrderPaymentReconcileService, useValue: orderPayments },
        ],
    }).compile()
    return { settlement: moduleRef.get(BankCreditSettlementService), reconcile, engine, inbound, orderPayments, tx, inbox }
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

    describe("a credit that names no invoice", () => {
        const event = { id: "ev-1", amount_vnd: 5000 } as InboundEventDetail
        const ctx = { workspaceId: "ws-1", actor: "NIVO", locale: "vi" }
        const outcomeOf = (effect: Outcome["effect"]): Outcome => ({ stage: "judge", effect, reasons: [], candidates: [] })

        it("opens the order work of a match or an ambiguity and does not hold the credit", async () => {
            const { settlement, reconcile, inbound, orderPayments } = await build()
            const outcome = outcomeOf({ kind: "apply", candidateId: "order-1" })
            reconcile.clearlyMatches.mockResolvedValue(false)
            inbound.find.mockResolvedValue(event)
            orderPayments.plan.mockResolvedValue(outcome)
            orderPayments.open.mockResolvedValue(itemOf({ status: "done" }))

            await settlement.settle(QUEUE, credit.dedupeKey, credit)

            expect(orderPayments.plan).toHaveBeenCalledWith(ctx, event)
            expect(orderPayments.open).toHaveBeenCalledWith(ctx, event, outcome)
            expect(inbound.holdForOwnerCheck).not.toHaveBeenCalled()
        })

        it("holds a credit the order run leaves, and one with no open order to match", async () => {
            const { settlement, reconcile, inbound, orderPayments } = await build()
            reconcile.clearlyMatches.mockResolvedValue(false)
            inbound.find.mockResolvedValue(event)
            orderPayments.plan.mockResolvedValueOnce(outcomeOf({ kind: "leave" })).mockResolvedValueOnce(null)
            orderPayments.open.mockResolvedValue(null)

            await settlement.settle(QUEUE, "k1", credit)
            await settlement.settle(QUEUE, "k2", credit)

            expect(inbound.holdForOwnerCheck).toHaveBeenCalledTimes(2)
        })

        it("does not look at orders for a credit that clearly matches an invoice", async () => {
            const { settlement, reconcile, inbound, orderPayments } = await build()
            reconcile.clearlyMatches.mockResolvedValue(true)

            await settlement.settle(QUEUE, credit.dedupeKey, credit)

            expect(inbound.find).not.toHaveBeenCalled()
            expect(orderPayments.plan).not.toHaveBeenCalled()
        })
    })
})
