import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { BankCreditSettlementService } from "./bank-credit-settlement.service"
import { ReconcilePaymentPerformerService } from "./reconcile-payment-performer.service"
import { itemOf } from "@tests/fixtures/builders/reconcile-payment-performer.builder"

const credit = { workspaceId: "ws-1", inboundEventId: "ev-1", amountVnd: 450000 }

/** The settlement over doubles of its three dependencies; the matching itself is the reconcile performer's own spec. */
const build = async () => {
    const reconcile = mock<ReconcilePaymentPerformerService>()
    const engine = mock<WorkEngineService>()
    engine.startInboundWork.mockResolvedValue(itemOf({ status: "done" }))
    const inbound = mock<InboundEventsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankCreditSettlementService,
            { provide: ReconcilePaymentPerformerService, useValue: reconcile },
            { provide: WorkEngineService, useValue: engine },
            { provide: InboundEventsService, useValue: inbound },
        ],
    }).compile()
    return { settlement: moduleRef.get(BankCreditSettlementService), reconcile, engine, inbound }
}

describe("BankCreditSettlementService settle", () => {
    it("reconciles by itself a credit that clearly matches one issued invoice", async () => {
        const { settlement, reconcile, engine, inbound } = await build()
        reconcile.clearlyMatches.mockResolvedValue(true)

        await expect(settlement.settle(credit)).resolves.toBeUndefined()

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

        await expect(settlement.settle(credit)).resolves.toBeUndefined()

        expect(engine.startInboundWork).not.toHaveBeenCalled()
        expect(inbound.holdForOwnerCheck).toHaveBeenCalledWith("ev-1")
    })

    it("pays once for a credit delivered twice: both runs ask the engine for the work keyed on the same credit", async () => {
        const { settlement, reconcile, engine, inbound } = await build()
        reconcile.clearlyMatches.mockResolvedValue(true)

        await settlement.settle(credit)
        await settlement.settle(credit)

        expect(engine.startInboundWork.mock.calls.map(([, source, action]) => [source, action])).toEqual([
            [{ id: "ev-1" }, "reconcile_payment"],
            [{ id: "ev-1" }, "reconcile_payment"],
        ])
        expect(inbound.holdForOwnerCheck).not.toHaveBeenCalled()
    })

    it("changes nothing for a payload that is not a bank credit", async () => {
        const { settlement, reconcile, engine, inbound } = await build()

        await expect(settlement.settle({ orderId: "order-1" })).resolves.toBeUndefined()

        expect(reconcile.clearlyMatches).not.toHaveBeenCalled()
        expect(engine.startInboundWork).not.toHaveBeenCalled()
        expect(inbound.holdForOwnerCheck).not.toHaveBeenCalled()
    })
})
