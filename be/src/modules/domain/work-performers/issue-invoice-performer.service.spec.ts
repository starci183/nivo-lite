import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EvidenceService } from "@modules/domain/decisions"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { InvoicesService } from "@modules/domain/invoices"
import type { InvoiceRow } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import type { OptionalOrder } from "@modules/domain/orders"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { IssueInvoicePerformerService } from "./issue-invoice-performer.service"
import { PaymentInstructionsService } from "./payment-instructions.service"
import { PerformerKitService } from "./performer-kit.service"
import { WorkPerformersLogEvent } from "./work-performers.log-events"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "issue_invoice",
    subject_type: "order",
    subject_id: "ord-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Invoice", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const orderOf = builder<NonNullable<OptionalOrder>>({
    id: "ord-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "SO-1",
    items: "2 tea boxes",
    amount_vnd: 450000,
    status: "confirmed",
    confirmed_by: "Lan",
    confirmed_at: "2026-10-12T09:00:00.000Z",
    created_at: "2026-10-12T09:00:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
})

const lead: LeadRecordRow = {
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "telegram",
    need: "wholesale",
    stage: "won",
    context_summary: null,
    phone: null,
    email: null,
}

const invoiceOf = builder<InvoiceRow>({
    id: "inv-1",
    workspace_id: "ws-1",
    order_id: "ord-1",
    lead_id: "lead-1",
    invoice_no: "INV-1",
    amount_vnd: 450000,
    status: "issued",
    issued_by: "Mai",
    paid_at: null,
})

const proposalOf = (amount: number | undefined, fields: Proposal["fields"] = {}): Proposal => ({
    summary: "Invoice",
    amount_vnd: amount,
    fields,
})

const build = async () => {
    const logger = mock<Logger>()
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    kit.money.mockImplementation((_ctx, amount) =>
        amount === null || amount === undefined ? "no amount" : `${amount} VND`,
    )
    const invoices = mock<InvoicesService>()
    invoices.issue.mockResolvedValue({ invoice: invoiceOf(), created: true })
    const orders = mock<OrdersService>()
    const leads = mock<LeadRecordsService>()
    leads.find.mockResolvedValue(lead)
    leads.require.mockResolvedValue(lead)
    const instructions = mock<PaymentInstructionsService>()
    instructions.send.mockResolvedValue("payInstructionsSent")
    const evidence = mock<EvidenceService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            IssueInvoicePerformerService,
            { provide: LOGGER, useValue: logger },
            { provide: PerformerKitService, useValue: kit },
            { provide: InvoicesService, useValue: invoices },
            { provide: OrdersService, useValue: orders },
            { provide: LeadRecordsService, useValue: leads },
            { provide: PaymentInstructionsService, useValue: instructions },
            { provide: EvidenceService, useValue: evidence },
        ],
    }).compile()
    return {
        service: moduleRef.get(IssueInvoicePerformerService),
        logger,
        invoices,
        orders,
        leads,
        instructions,
        evidence,
    }
}

describe("IssueInvoicePerformerService prepare", () => {
    it("takes the amount and the customer from the order the item is about", async () => {
        const { service, orders } = await build()
        orders.find.mockResolvedValue(orderOf())

        await expect(service.prepare(ctx, itemOf())).resolves.toEqual({
            proposal: {
                summary: "invoiceSummary|Lan|450000 VND",
                amount_vnd: 450000,
                fields: { customer: "Lan", amount_vnd: 450000, order_no: "SO-1" },
            },
            patch: { lead_id: "lead-1" },
        })
    })

    it("names no customer for an order that has none", async () => {
        const { service, orders, leads } = await build()
        orders.find.mockResolvedValue(orderOf({ lead_id: null, amount_vnd: null }))

        const prepared = await service.prepare(ctx, itemOf())

        expect(prepared.proposal.summary).toBe("invoiceSummary||no amount")
        expect(prepared.proposal.fields.customer).toBeNull()
        expect(prepared.patch).toEqual({ lead_id: null })
        expect(leads.find).not.toHaveBeenCalled()
    })

    it("names no customer when the order's customer is gone", async () => {
        const { service, orders, leads } = await build()
        orders.find.mockResolvedValue(orderOf())
        leads.find.mockResolvedValue(null)

        const prepared = await service.prepare(ctx, itemOf())

        expect(prepared.proposal.fields.customer).toBeNull()
    })

    it("refuses an order that is gone", async () => {
        const { service, orders } = await build()
        orders.find.mockResolvedValue(null)

        await expect(service.prepare(ctx, itemOf())).rejects.toMatchObject({
            code: WorkPerformersErrorCode.OrderUnavailable,
        })
    })

    it("takes the amount from the proposal when the item is about the customer", async () => {
        const { service } = await build()
        const item = itemOf({
            subject_type: "lead",
            subject_id: "lead-1",
            proposal: proposalOf(300000, { note: "x" }),
        })

        await expect(service.prepare(ctx, item)).resolves.toEqual({
            proposal: {
                summary: "invoiceSummary|Lan|300000 VND",
                amount_vnd: 300000,
                fields: { note: "x", customer: "Lan", amount_vnd: 300000 },
            },
        })
    })
})

describe("IssueInvoicePerformerService prepare", () => {
    it("reads the amount from the fields, else none", async () => {
        const { service } = await build()
        const fromFields = itemOf({ subject_type: "lead", proposal: proposalOf(undefined, { amount_vnd: 120000 }) })
        const withNone = itemOf({ subject_id: null, proposal: proposalOf(undefined, { amount_vnd: "lots" }) })

        const first = await service.prepare(ctx, fromFields)
        const second = await service.prepare(ctx, withNone)

        expect(first.proposal.amount_vnd).toBe(120000)
        expect(second.proposal.amount_vnd).toBeNull()
    })

    it("refuses an item without an order or a customer", async () => {
        const { service } = await build()

        await expect(service.prepare(ctx, itemOf({ subject_type: "lead", lead_id: null }))).rejects.toMatchObject({
            code: WorkPerformersErrorCode.SubjectMissing,
        })
    })
})

describe("IssueInvoicePerformerService perform", () => {
    it("issues the invoice, marks the order invoiced and sends the payment instructions", async () => {
        const { service, invoices, orders, instructions, evidence } = await build()
        const item = itemOf()

        await expect(service.perform(ctx, item, proposalOf(450000), { name: "Mai" })).resolves.toEqual({
            summary: "invoiceIssued|INV-1|450000 VND|internalInvoice",
            evidence: "captured",
            href: "/leads/lead-1",
            lead_id: "lead-1",
            detail: "payInstructionsSent",
        })
        expect(invoices.issue).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            orderId: "ord-1",
            leadId: "lead-1",
            amountVnd: 450000,
            issuedBy: "Mai",
        })
        expect(orders.markInvoiced).toHaveBeenCalledWith("ws-1", "ord-1")
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead-1",
            work_item_id: "item-1",
            kind: "invoice.issued",
            actor: "Mai",
            summary: "invoiceIssued|INV-1|450000 VND|internalInvoice",
        })
        expect(instructions.send).toHaveBeenCalledWith(ctx, item, invoiceOf())
    })

    it("gives an order that has its invoice no second one", async () => {
        const { service, invoices, orders, evidence } = await build()
        invoices.issue.mockResolvedValue({ invoice: invoiceOf({ lead_id: null }), created: false })

        await expect(service.perform(ctx, itemOf(), proposalOf(450000), { name: "Mai" })).resolves.toEqual({
            summary: "invoiceExists|INV-1",
            evidence: "captured",
            href: "/chat",
            lead_id: null,
        })
        expect(orders.markInvoiced).not.toHaveBeenCalled()
        expect(evidence.log).not.toHaveBeenCalled()
    })

    it("issues a lead's invoice from the amount of the fields and still sends the instructions", async () => {
        const { service, invoices, orders, instructions } = await build()
        const item = itemOf({ subject_type: "lead", subject_id: "lead-1" })

        const performed = await service.perform(ctx, item, proposalOf(undefined, { amount_vnd: "200000" }), {
            name: "Mai",
        })

        expect(performed.detail).toBe("payInstructionsSent")
        expect(invoices.issue.mock.calls[0]?.[0]).toMatchObject({ orderId: null, amountVnd: 200000 })
        expect(orders.markInvoiced).not.toHaveBeenCalled()
        expect(instructions.send).toHaveBeenCalledTimes(1)
    })

    it("issues for nothing when the amount cannot be read", async () => {
        const { service, invoices } = await build()

        await service.perform(ctx, itemOf(), proposalOf(undefined, { amount_vnd: "lots" }), { name: "Mai" })

        expect(invoices.issue.mock.calls[0]?.[0].amountVnd).toBe(0)
    })
})

describe("IssueInvoicePerformerService perform", () => {
    it("keeps the invoice when the instructions cannot be delivered", async () => {
        const { service, instructions, logger } = await build()
        const cause = new WorkPerformersError({ code: WorkPerformersErrorCode.EmailNotSent })
        instructions.send.mockRejectedValue(cause)

        const performed = await service.perform(ctx, itemOf(), proposalOf(450000), { name: "Mai" })

        expect(performed.detail).toBeNull()
        expect(performed.summary).toBe("invoiceIssued|INV-1|450000 VND|internalInvoice")
        expect(logger.error).toHaveBeenCalledWith(WorkPerformersLogEvent.InstructionsFailed, cause, {
            workItemId: "item-1",
        })
    })
})
