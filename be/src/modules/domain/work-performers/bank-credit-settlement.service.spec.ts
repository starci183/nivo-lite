import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AutomationBusinessEventsService } from "@modules/domain/automations"
import { ContractsService } from "@modules/domain/contracts"
import { EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InvoicesService } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { TransactionsService } from "@modules/domain/transactions"
import { WorkItemsService } from "@modules/domain/work-items"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BankCreditSettlementService } from "./bank-credit-settlement.service"
import { PerformerKitService } from "./performer-kit.service"
import { ReconcilePaymentPerformerService } from "./reconcile-payment-performer.service"
import { eventOf, issuedOf, itemOf } from "@tests/fixtures/builders/reconcile-payment-performer.builder"

const credit = { workspaceId: "ws-1", inboundEventId: "ev-1", amountVnd: 450000 }

/** The settlement over the real matching of the reconcile performer; only the records and the engine are doubles. */
const build = async () => {
    const inbound = mock<InboundEventsService>()
    const invoices = mock<InvoicesService>()
    invoices.listIssued.mockResolvedValue([
        issuedOf(),
        issuedOf({ id: "inv-2", invoice_no: "INV-2", order_no: null, lead_id: null, amount_vnd: 300000 }),
    ])
    const engine = mock<WorkEngineService>()
    engine.startInboundWork.mockResolvedValue(itemOf({ status: "done" }))
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankCreditSettlementService,
            ReconcilePaymentPerformerService,
            { provide: WorkEngineService, useValue: engine },
            { provide: InboundEventsService, useValue: inbound },
            { provide: InvoicesService, useValue: invoices },
            { provide: PerformerKitService, useValue: mock<PerformerKitService>() },
            { provide: TransactionsService, useValue: mock<TransactionsService>() },
            { provide: OrdersService, useValue: mock<OrdersService>() },
            { provide: WorkItemsService, useValue: mock<WorkItemsService>() },
            { provide: EvidenceService, useValue: mock<EvidenceService>() },
            { provide: LeadRecordsService, useValue: mock<LeadRecordsService>() },
            { provide: AutomationBusinessEventsService, useValue: mock<AutomationBusinessEventsService>() },
            { provide: ContractsService, useValue: mock<ContractsService>() },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return { settlement: moduleRef.get(BankCreditSettlementService), inbound, invoices, engine }
}

describe("BankCreditSettlementService settle", () => {
    it("reconciles by itself a credit whose content names one issued invoice of the same amount", async () => {
        const { settlement, inbound, invoices, engine } = await build()
        inbound.find.mockResolvedValue(eventOf({ amount_vnd: 450000, external_ref: "INV1 thanh toan" }))

        await expect(settlement.settle(credit)).resolves.toBeUndefined()

        expect(inbound.find).toHaveBeenCalledWith("ws-1", "ev-1")
        expect(invoices.listIssued).toHaveBeenCalledWith("ws-1", 50)
        expect(engine.startInboundWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "NIVO", locale: "vi" },
            { id: "ev-1" },
            "reconcile_payment",
            { amount_vnd: 450000 },
            null,
        )
        expect(inbound.holdForOwnerCheck).not.toHaveBeenCalled()
    })

    it.each([
        ["names no invoice", { amount_vnd: 450000, external_ref: "chuyen tien", body: "CK" }],
        ["names an invoice of another amount", { amount_vnd: 400000, external_ref: "INV-1" }],
        ["names two invoices", { amount_vnd: 450000, external_ref: "INV-1 INV-2" }],
        ["carries no amount", { amount_vnd: null, external_ref: "INV-1" }],
    ])("holds a credit that %s for the owner's check", async (_name, change) => {
        const { settlement, inbound, engine } = await build()
        inbound.find.mockResolvedValue(eventOf(change))

        await settlement.settle(credit)

        expect(engine.startInboundWork).not.toHaveBeenCalled()
        expect(inbound.holdForOwnerCheck).toHaveBeenCalledWith("ev-1")
    })

    it("holds a credit that is no longer on record", async () => {
        const { settlement, inbound, engine } = await build()
        inbound.find.mockResolvedValue(null)

        await settlement.settle(credit)

        expect(engine.startInboundWork).not.toHaveBeenCalled()
        expect(inbound.holdForOwnerCheck).toHaveBeenCalledWith("ev-1")
    })

    it("pays once for a credit delivered twice: both runs ask the engine for the work keyed on the same credit", async () => {
        const { settlement, inbound, engine } = await build()
        inbound.find.mockResolvedValue(eventOf({ amount_vnd: 450000, external_ref: "INV-1" }))

        await settlement.settle(credit)
        await settlement.settle(credit)

        expect(engine.startInboundWork.mock.calls.map(([, source, action]) => [source, action])).toEqual([
            [{ id: "ev-1" }, "reconcile_payment"],
            [{ id: "ev-1" }, "reconcile_payment"],
        ])
        expect(inbound.holdForOwnerCheck).not.toHaveBeenCalled()
    })

    it("changes nothing for a payload that is not a bank credit", async () => {
        const { settlement, inbound, engine } = await build()

        await settlement.settle({ orderId: "order-1" })

        expect(inbound.find).not.toHaveBeenCalled()
        expect(engine.startInboundWork).not.toHaveBeenCalled()
        expect(inbound.holdForOwnerCheck).not.toHaveBeenCalled()
    })
})
