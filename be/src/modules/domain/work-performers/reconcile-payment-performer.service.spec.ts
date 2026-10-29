import { fakeTransaction, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { DecisionsErrorCode, EvidenceService } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InvoicesService } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { TransactionsService } from "@modules/domain/transactions"
import { WorkItemsService } from "@modules/domain/work-items"
import { PaymentReconciledEvent } from "@modules/events/api"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import type { BaseEvent } from "@modules/platform/event-bus"
import { PerformerKitService } from "./performer-kit.service"
import { ReconcilePaymentPerformerService } from "./reconcile-payment-performer.service"
import {
    ctx,
    eventOf,
    invoiceOf,
    issuedOf,
    itemOf,
    leadOf,
    orderOf,
    proposalOf,
    transactionOf,
} from "@tests/fixtures/builders/reconcile-payment-performer.builder"

const build = async () => {
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    kit.money.mockImplementation((_ctx, amount) =>
        amount === null || amount === undefined ? "no amount" : `${amount} VND`,
    )
    const transactions = mock<TransactionsService>()
    transactions.find.mockResolvedValue(transactionOf())
    transactions.open.mockResolvedValue(transactionOf({ id: "tx-2", amount_vnd: 300000, reference: null, payer: null }))
    const invoices = mock<InvoicesService>()
    invoices.listIssued.mockResolvedValue([
        issuedOf(),
        issuedOf({
            id: "inv-2",
            invoice_no: "INV-2",
            order_no: null,
            lead_id: null,
            contact_name: null,
            amount_vnd: 300000,
        }),
    ])
    invoices.markPaid.mockResolvedValue(invoiceOf())
    invoices.find.mockResolvedValue(invoiceOf())
    const orders = mock<OrdersService>()
    const inbound = mock<InboundEventsService>()
    const workItems = mock<WorkItemsService>()
    workItems.settleClaims.mockResolvedValue([])
    const evidence = mock<EvidenceService>()
    const leads = mock<LeadRecordsService>()
    const bus = recordingEventBus<BaseEvent>()
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef = await Test.createTestingModule({
        providers: [
            ReconcilePaymentPerformerService,
            { provide: PerformerKitService, useValue: kit },
            { provide: TransactionsService, useValue: transactions },
            { provide: InvoicesService, useValue: invoices },
            { provide: OrdersService, useValue: orders },
            { provide: InboundEventsService, useValue: inbound },
            { provide: WorkItemsService, useValue: workItems },
            { provide: EvidenceService, useValue: evidence },
            { provide: LeadRecordsService, useValue: leads },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: EVENT_BUS, useValue: bus },
        ],
    }).compile()
    return {
        service: moduleRef.get(ReconcilePaymentPerformerService),
        transactions,
        invoices,
        orders,
        inbound,
        workItems,
        evidence,
        leads,
        bus,
        tx,
    }
}

describe("ReconcilePaymentPerformerService prepare", () => {
    it("clears a payment whose transfer content names one invoice of the same amount", async () => {
        const { service, invoices, transactions } = await build()

        await expect(service.prepare(ctx, itemOf())).resolves.toEqual({
            proposal: {
                summary: "reconcileSummary|450000 VND|Lan|INV-1 Lan",
                amount_vnd: 450000,
                outcome: "clear",
                candidates: [{ id: "inv-1", label: "candidateLabel|INV-1|Lan|450000 VND", amount_vnd: 450000 }],
                fields: { amount_vnd: 450000, reference: "INV-1 Lan", payer: "Lan", match: "matchedByCodeAmount" },
            },
            patch: { subject_type: "transaction", subject_id: "tx-1", lead_id: "lead-1" },
        })
        expect(invoices.listIssued).toHaveBeenCalledWith("ws-1", 50)
        expect(transactions.open).not.toHaveBeenCalled()
    })

    it("records a bank credit as a new transaction and offers the invoices of the same amount", async () => {
        const { service, inbound, transactions } = await build()
        inbound.find.mockResolvedValue(eventOf())
        const item = itemOf({ subject_type: "inbound", subject_id: "ev-1", inbound_event_id: "ev-1" })

        await expect(service.prepare(ctx, item)).resolves.toEqual({
            proposal: {
                summary: "bankCredit|SePay|300000 VND|reconcileNoRef|reconcileUnknownPayer",
                amount_vnd: 300000,
                outcome: "unclear",
                candidates: [{ id: "inv-2", label: "candidateLabel|INV-2|—|300000 VND", amount_vnd: 300000 }],
                fields: { amount_vnd: 300000, reference: null, payer: null, bank: "SePay" },
            },
            patch: { subject_type: "transaction", subject_id: "tx-2" },
        })
        expect(transactions.open).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            inboundEventId: "ev-1",
            amountVnd: 300000,
            reference: null,
            payer: null,
        })
    })

    it("opens a transaction from the proposal's amount when there is no input", async () => {
        const { service, transactions } = await build()
        const item = itemOf({
            subject_type: "invoice",
            proposal: { summary: "Paid", amount_vnd: 200000, fields: {} },
        })

        await service.prepare(ctx, item)
        await service.prepare(ctx, itemOf({ subject_id: null }))

        expect(transactions.open.mock.calls[0]?.[0].amountVnd).toBe(200000)
        expect(transactions.open.mock.calls[1]?.[0].amountVnd).toBe(0)
    })

    it("does not tie a clear match to a customer when its invoice has none", async () => {
        const { service, invoices } = await build()
        invoices.listIssued.mockResolvedValue([issuedOf({ lead_id: null })])

        const prepared = await service.prepare(ctx, itemOf())

        expect(prepared.proposal.outcome).toBe("clear")
        expect(prepared.patch).toEqual({ subject_type: "transaction", subject_id: "tx-1" })
    })
})

describe("ReconcilePaymentPerformerService prepare", () => {
    it("reopens a missing transaction using a non-bank input's facts and leaves an empty candidate pool", async () => {
        const { service, transactions, invoices, inbound } = await build()
        transactions.find.mockResolvedValue(null)
        transactions.open.mockResolvedValue(transactionOf({ id: "tx-2", reference: null, payer: "Mai" }))
        invoices.listIssued.mockResolvedValue([])
        inbound.find.mockResolvedValue(
            eventOf({ channel: "zalo", amount_vnd: null, external_ref: "CLAIM-9", sender_name: "Mai" }),
        )
        const item = itemOf({
            inbound_event_id: "ev-1",
            proposal: { summary: "Paid", amount_vnd: 450000, fields: {} },
        })

        await expect(service.prepare(ctx, item)).resolves.toEqual({
            proposal: {
                summary: "reconcileSummary|450000 VND|Mai|reconcileNoRef",
                amount_vnd: 450000,
                outcome: "unclear",
                candidates: [],
                fields: { amount_vnd: 450000, reference: null, payer: "Mai" },
            },
            patch: { subject_type: "transaction", subject_id: "tx-2" },
        })
        expect(transactions.find).toHaveBeenCalledWith("ws-1", "tx-1")
        expect(transactions.open).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            inboundEventId: "ev-1",
            amountVnd: 450000,
            reference: "CLAIM-9",
            payer: "Mai",
        })
    })
})

describe("ReconcilePaymentPerformerService perform", () => {
    it("marks the chosen invoice paid, links the payment and settles the waiting claims", async () => {
        const { service, invoices, transactions, orders, inbound, workItems, evidence } = await build()
        workItems.settleClaims.mockResolvedValue([
            { id: "item-7", inbound_event_id: "ev-7" },
            { id: "item-8", inbound_event_id: null },
        ])
        const item = itemOf({ inbound_event_id: "ev-1" })

        await expect(service.perform(ctx, item, proposalOf(), { name: "Mai" })).resolves.toEqual({
            summary: "paymentMatched|450000 VND|INV-1",
            evidence: "verified",
            href: "/leads/lead-1",
            lead_id: "lead-1",
            detail: "matchedByCodeAmount",
        })
        expect(transactions.match).toHaveBeenCalledWith("ws-1", "tx-1", "inv-1", expect.anything())
        expect(orders.markPaid).toHaveBeenCalledWith("ws-1", "ord-1", expect.anything())
        expect(inbound.mark).toHaveBeenCalledWith("ws-1", "ev-1", null, "lead-1", expect.anything())
        expect(inbound.mark).toHaveBeenCalledWith("ws-1", "ev-7", "processed", null)
        expect(inbound.mark).toHaveBeenCalledTimes(2)
        expect(workItems.settleClaims).toHaveBeenCalledWith("ws-1", "item-1", "reconcile_payment:invoice:inv-1", {
            summary: "claimSettled|INV-1",
            href: "/leads/lead-1",
        })
        expect(invoices.markPaid).toHaveBeenCalledWith("ws-1", "inv-1", expect.anything())
        const [matched, ...settled] = evidence.log.mock.calls.map(([, entry]) => entry)
        expect([
            matched,
            ...settled.sort((left, right) => (left.work_item_id ?? "").localeCompare(right.work_item_id ?? "")),
        ]).toEqual([
            {
                lead_id: "lead-1",
                work_item_id: "item-1",
                kind: "payment.matched",
                actor: "Mai",
                summary: "paymentMatched|450000 VND|INV-1",
                evidence: "matchedByCodeAmount · INV-1 Lan",
            },
            {
                lead_id: "lead-1",
                work_item_id: "item-7",
                kind: "work.settled",
                actor: "NIVO",
                summary: "claimSettled|INV-1",
            },
            {
                lead_id: "lead-1",
                work_item_id: "item-8",
                kind: "work.settled",
                actor: "NIVO",
                summary: "claimSettled|INV-1",
            },
        ])
    })
})

describe("ReconcilePaymentPerformerService perform", () => {
    it("settles a customer's claim on an invoice and prefixes the bank credit line", async () => {
        const { service, invoices, transactions, orders, inbound, evidence } = await build()
        invoices.markPaid.mockResolvedValue(invoiceOf({ order_id: null, lead_id: null }))
        const item = itemOf({ subject_type: "invoice", subject_id: "inv-1" })
        const proposal = proposalOf({
            summary: "SePay credit",
            amount_vnd: undefined,
            fields: { bank: "SePay" },
        })

        await expect(service.perform(ctx, item, proposal, { name: "Mai" })).resolves.toEqual({
            summary: "SePay credit · paymentMatched|no amount|INV-1",
            evidence: "verified",
            href: "/chat",
            lead_id: null,
            detail: null,
        })
        expect(invoices.markPaid).toHaveBeenCalledWith("ws-1", "inv-1", expect.anything())
        expect(transactions.match).not.toHaveBeenCalled()
        expect(orders.markPaid).not.toHaveBeenCalled()
        expect(inbound.mark).not.toHaveBeenCalled()
        expect(evidence.log.mock.calls[0]?.[1].evidence).toBeNull()
    })

    it("links no transaction when the item names none", async () => {
        const { service, transactions } = await build()

        await service.perform(ctx, itemOf({ subject_id: null }), proposalOf(), { name: "Mai" })

        expect(transactions.match).not.toHaveBeenCalled()
    })

    it("asks for exactly one chosen invoice", async () => {
        const { service, invoices } = await build()
        const two = proposalOf({
            candidates: [
                { id: "inv-1", label: "INV-1", amount_vnd: 450000 },
                { id: "inv-2", label: "INV-2", amount_vnd: 450000 },
            ],
        })

        await expect(
            service.perform(ctx, itemOf(), proposalOf({ candidates: undefined }), { name: "Mai" }),
        ).rejects.toMatchObject({ code: DecisionsErrorCode.ChooseCandidate })
        await expect(service.perform(ctx, itemOf(), two, { name: "Mai" })).rejects.toMatchObject({
            code: DecisionsErrorCode.ChooseCandidate,
        })
        expect(invoices.markPaid).not.toHaveBeenCalled()
    })
})

describe("ReconcilePaymentPerformerService perform", () => {
    it("publishes the settled invoice with its known customer and order in the transaction that paid it", async () => {
        const { service, leads, orders, bus, tx } = await build()
        leads.find.mockResolvedValue(leadOf())
        orders.find.mockResolvedValue(orderOf())

        const performed = await service.perform(ctx, itemOf(), proposalOf(), { name: "Mai" })

        expect(performed.summary).toBe("paymentMatched|450000 VND|INV-1")
        expect(leads.find).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(orders.find).toHaveBeenCalledWith("ws-1", "ord-1")
        expect(bus.writes.map((event) => [event.constructor, event.payload])).toEqual([
            [
                PaymentReconciledEvent,
                {
                    dedupeKey: "inv-1",
                    workspaceId: "ws-1",
                    invoiceId: "inv-1",
                    invoiceNo: "INV-1",
                    amountVnd: 450000,
                    paidAt: "2026-10-12T10:00:00.000Z",
                    transactionId: "tx-1",
                    workItemId: "item-1",
                    subjectType: "transaction",
                    subjectId: "tx-1",
                    orderId: "ord-1",
                    orderNo: "SO-9",
                    leadId: "lead-1",
                    customer: "Mai",
                    channel: "Zalo",
                },
            ],
        ])
        expect(bus.allInTransaction).toBe(true)
        expect(tx.commits).toBe(1)
    })

    it("rolls the payment back and publishes nothing when the fact cannot be sent", async () => {
        const failure = new Error("bus down")
        const { service, bus, tx, workItems } = await build()
        bus.failNext("publish", failure)

        await expect(service.perform(ctx, itemOf(), proposalOf(), { name: "Mai" })).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
        expect(workItems.settleClaims).not.toHaveBeenCalled()
    })
})

describe("ReconcilePaymentPerformerService perform", () => {
    it("publishes an invoice-only receipt with proposal payer and invoice amount when records are missing", async () => {
        const { service, leads, orders, bus, evidence } = await build()
        leads.find.mockResolvedValue(null)
        orders.find.mockResolvedValue(null)
        const proposal = proposalOf({ amount_vnd: null, fields: { payer: "Customer", reference: "TRANSFER-9" } })

        await expect(
            service.perform(ctx, itemOf({ subject_type: "invoice" }), proposal, { name: "Mai" }),
        ).resolves.toEqual({
            summary: "paymentMatched|no amount|INV-1",
            evidence: "verified",
            href: "/leads/lead-1",
            lead_id: "lead-1",
            detail: null,
        })
        expect(evidence.log).toHaveBeenCalledWith(
            ctx,
            {
                lead_id: "lead-1",
                work_item_id: "item-1",
                kind: "payment.matched",
                actor: "Mai",
                summary: "paymentMatched|no amount|INV-1",
                evidence: "TRANSFER-9",
            },
            expect.anything(),
        )
        expect(bus.writes[0]?.payload).toMatchObject({
            invoiceId: "inv-1",
            subjectType: "invoice",
            orderId: "ord-1",
            leadId: "lead-1",
            customer: "Customer",
            amountVnd: 450000,
        })
        for (const field of ["transactionId", "orderNo", "channel"]) {
            expect(bus.writes[0]?.payload).not.toHaveProperty(field)
        }
    })

    it("publishes no customer or order when the settled invoice cannot be read back", async () => {
        const { service, invoices, leads, orders, bus } = await build()
        invoices.find.mockResolvedValue(null)

        await service.perform(ctx, itemOf(), proposalOf(), { name: "Mai" })

        expect(leads.find).not.toHaveBeenCalled()
        expect(orders.find).not.toHaveBeenCalled()
        expect(bus.writes[0]?.payload).toMatchObject({ customer: "" })
        expect(bus.writes[0]?.payload).not.toHaveProperty("channel")
        expect(bus.writes[0]?.payload).not.toHaveProperty("orderNo")
    })

    it("names the renewed contract and its term in the fact so the contracts reactor can renew it", async () => {
        const { service, invoices, bus } = await build()
        invoices.markPaid.mockResolvedValue(
            invoiceOf({ contract_id: "contract-1", period_ends_on: "2027-01-01", invoice_no: "INV-202612-0001" }),
        )

        await service.perform(ctx, itemOf(), proposalOf(), { name: "Mai" })

        expect(bus.writes[0]?.payload).toMatchObject({
            invoiceNo: "INV-202612-0001",
            contractId: "contract-1",
            periodEndsOn: "2027-01-01",
        })
    })
})

describe("ReconcilePaymentPerformerService onReject", () => {
    it("sends a rejected bank payment back to review", async () => {
        const { service, transactions } = await build()

        await expect(service.onReject(ctx, itemOf())).resolves.toBeUndefined()
        expect(transactions.sendToReview).toHaveBeenCalledWith("ws-1", "tx-1")
    })

    it("changes nothing for an item that is not a transaction", async () => {
        const { service, transactions } = await build()

        await service.onReject(ctx, itemOf({ subject_type: "invoice" }))
        await service.onReject(ctx, itemOf({ subject_id: null }))

        expect(transactions.sendToReview).not.toHaveBeenCalled()
    })
})

describe("ReconcilePaymentPerformerService clearlyMatches", () => {
    it.each([
        [
            "names one issued invoice of the same amount",
            eventOf({ amount_vnd: 450000, external_ref: "INV1 thanh toan" }),
            true,
        ],
        ["names no invoice", eventOf({ amount_vnd: 450000, external_ref: "chuyen tien", body: "CK" }), false],
        ["names an invoice of another amount", eventOf({ amount_vnd: 400000, external_ref: "INV-1" }), false],
        ["names two invoices", eventOf({ amount_vnd: 450000, external_ref: "INV-1 INV-2" }), false],
        ["carries no amount", eventOf({ amount_vnd: null, external_ref: "INV-1" }), false],
        ["is no longer on record", null, false],
    ])("tells whether a bank credit that %s clearly matches", async (_name, event, clear) => {
        const { service, inbound } = await build()
        inbound.find.mockResolvedValue(event)

        await expect(service.clearlyMatches(ctx, "ev-1")).resolves.toBe(clear)
        expect(inbound.find).toHaveBeenCalledWith("ws-1", "ev-1")
    })
})
