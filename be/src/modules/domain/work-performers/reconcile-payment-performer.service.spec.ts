import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AutomationBusinessEventsService } from "@modules/domain/automations"
import { DecisionsErrorCode, EvidenceService } from "@modules/domain/decisions"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { OptionalInboundEvent } from "@modules/domain/inbound-events"
import { InvoicesService } from "@modules/domain/invoices"
import type { InvoiceRow } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { TransactionsService } from "@modules/domain/transactions"
import type { OptionalTransaction } from "@modules/domain/transactions"
import { WorkItemsService } from "@modules/domain/work-items"
import { PerformerKitService } from "./performer-kit.service"
import { ReconcilePaymentPerformerService } from "./reconcile-payment-performer.service"

type IssuedInvoice = Awaited<ReturnType<InvoicesService["listIssued"]>>[number]

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "reconcile_payment",
    subject_type: "transaction",
    subject_id: "tx-1",
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Payment", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const transactionOf = builder<NonNullable<OptionalTransaction>>({
    id: "tx-1",
    workspace_id: "ws-1",
    inbound_event_id: null,
    amount_vnd: 450000,
    reference: "INV-1 Lan",
    payer: "Lan",
    invoice_id: null,
    status: "unmatched",
    origin: "live",
})

const issuedOf = builder<IssuedInvoice>({
    id: "inv-1",
    workspace_id: "ws-1",
    order_id: "ord-1",
    lead_id: "lead-1",
    invoice_no: "INV-1",
    amount_vnd: 450000,
    status: "issued",
    origin: "live",
    issued_by: "Mai",
    paid_at: null,
    order_no: "SO-1",
    contact_name: "Lan",
})

const invoiceOf = builder<InvoiceRow>({
    id: "inv-1",
    workspace_id: "ws-1",
    order_id: "ord-1",
    lead_id: "lead-1",
    invoice_no: "INV-1",
    amount_vnd: 450000,
    status: "paid",
    origin: "live",
    issued_by: "Mai",
    paid_at: "2026-10-12T10:00:00.000Z",
})

const eventOf = builder<NonNullable<OptionalInboundEvent>>({
    id: "ev-1",
    workspace_id: "ws-1",
    channel: "bank",
    kind: "payment",
    origin: "live",
    sender_name: null,
    sender_contact: null,
    body: "CK chuyen tien",
    amount_vnd: 300000,
    external_ref: null,
    event_id: "vietcombank:123",
    lead_id: null,
    status: "new",
})

const proposalOf = builder<Proposal>({
    summary: "Payment",
    amount_vnd: 450000,
    fields: { reference: "INV-1 Lan", match: "matchedByCodeAmount" },
    candidates: [{ id: "inv-1", label: "INV-1", amount_vnd: 450000 }],
})

describe("ReconcilePaymentPerformerService", () => {
    const build = async () => {
        const kit = mock<PerformerKitService>()
        kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
        kit.money.mockImplementation((_ctx, amount) =>
            amount === null || amount === undefined ? "no amount" : `${amount} VND`,
        )
        const transactions = mock<TransactionsService>()
        transactions.find.mockResolvedValue(transactionOf())
        transactions.open.mockResolvedValue(
            transactionOf({ id: "tx-2", amount_vnd: 300000, reference: null, payer: null }),
        )
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
        const orders = mock<OrdersService>()
        const inbound = mock<InboundEventsService>()
        const workItems = mock<WorkItemsService>()
        workItems.settleClaims.mockResolvedValue([])
        const evidence = mock<EvidenceService>()
        const leads = mock<LeadRecordsService>()
        const events = mock<AutomationBusinessEventsService>()
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
                { provide: AutomationBusinessEventsService, useValue: events },
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
        }
    }

    describe("prepare", () => {
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
            expect(invoices.listIssued).toHaveBeenCalledWith("ws-1", 50, "live")
            expect(transactions.open).not.toHaveBeenCalled()
        })

        it("records a bank credit as a new transaction and offers the invoices of the same amount", async () => {
            const { service, inbound, transactions } = await build()
            inbound.find.mockResolvedValue(eventOf())
            const item = itemOf({ subject_type: "inbound", subject_id: "ev-1", inbound_event_id: "ev-1" })

            await expect(service.prepare(ctx, item)).resolves.toEqual({
                proposal: {
                    summary: "bankCredit|Vietcombank|300000 VND|reconcileNoRef|reconcileUnknownPayer",
                    amount_vnd: 300000,
                    outcome: "unclear",
                    candidates: [{ id: "inv-2", label: "candidateLabel|INV-2|—|300000 VND", amount_vnd: 300000 }],
                    fields: { amount_vnd: 300000, reference: null, payer: null, bank: "Vietcombank" },
                },
                patch: { subject_type: "transaction", subject_id: "tx-2" },
            })
            expect(transactions.open).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                inboundEventId: "ev-1",
                amountVnd: 300000,
                reference: null,
                payer: null,
                origin: "live",
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

    describe("perform", () => {
        it("marks the chosen invoice paid, links the payment and settles the waiting claims", async () => {
            const { service, transactions, orders, inbound, workItems, evidence } = await build()
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
            expect(transactions.match).toHaveBeenCalledWith("ws-1", "tx-1", "inv-1")
            expect(orders.markPaid).toHaveBeenCalledWith("ws-1", "ord-1")
            expect(inbound.mark).toHaveBeenCalledWith("ws-1", "ev-1", null, "lead-1")
            expect(inbound.mark).toHaveBeenCalledWith("ws-1", "ev-7", "processed", null)
            expect(inbound.mark).toHaveBeenCalledTimes(2)
            expect(workItems.settleClaims).toHaveBeenCalledWith("ws-1", "item-1", "reconcile_payment:invoice:inv-1", {
                summary: "claimSettled|INV-1",
                href: "/leads/lead-1",
            })
            expect(evidence.log.mock.calls.map(([, entry]) => entry)).toEqual([
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

        it("settles a customer's claim on an invoice and prefixes the bank credit line", async () => {
            const { service, invoices, transactions, orders, inbound, evidence } = await build()
            invoices.markPaid.mockResolvedValue(invoiceOf({ order_id: null, lead_id: null }))
            const item = itemOf({ subject_type: "invoice", subject_id: "inv-1", origin: "simulated" })
            const proposal = proposalOf({
                summary: "Vietcombank credit",
                amount_vnd: undefined,
                fields: { bank: "VCB" },
            })

            await expect(service.perform(ctx, item, proposal, { name: "Mai" })).resolves.toEqual({
                summary: "Vietcombank credit · paymentMatched|no amount|INV-1",
                evidence: "verified",
                href: "/chat",
                lead_id: null,
                detail: null,
            })
            expect(invoices.markPaid).toHaveBeenCalledWith("ws-1", "inv-1", "simulated")
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

    describe("onReject", () => {
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
})
