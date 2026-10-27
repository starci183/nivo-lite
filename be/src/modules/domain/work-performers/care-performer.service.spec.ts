import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { formatVnd } from "@modules/domain/decisions"
import type { Performed, WorkContext, WorkItem } from "@modules/domain/decisions"
import { InvoicesService } from "@modules/domain/invoices"
import type { InvoiceRow } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { TransactionsService } from "@modules/domain/transactions"
import { AiGenerationsError, AiGenerationsErrorCode } from "@modules/domain/ai-generations"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CarePerformerService } from "./care-performer.service"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"
import { PROMPT_WRITER } from "./work-performers.decorators"
import type { PromptWriter } from "./work-performers.port"
import { WorkPerformersLogEvent } from "./work-performers.log-events"

type Transaction = NonNullable<Awaited<ReturnType<TransactionsService["find"]>>>

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_care",
    subject_type: "lead",
    subject_id: "lead-1",
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
    proposal: { summary: "Thank the customer", fields: {} },
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

const lead: LeadRecordRow = {
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "zalo",
    need: "wholesale",
    stage: "won",
    context_summary: null,
    phone: "84901234567",
    email: null,
}

const invoiceOf = builder<InvoiceRow>({
    id: "inv-1",
    workspace_id: "ws-1",
    order_id: "ord-1",
    lead_id: "lead-1",
    invoice_no: "INV-1",
    amount_vnd: 450000,
    status: "paid",
    issued_by: "Lan",
    paid_at: "2026-10-12T09:00:00.000Z",
    contract_id: null,
    period_ends_on: null,
})

const transactionOf = builder<Transaction>({
    id: "tx-1",
    workspace_id: "ws-1",
    inbound_event_id: null,
    amount_vnd: 500000,
    reference: "INV-1",
    payer: "Lan",
    invoice_id: "inv-1",
    status: "matched",
})

const performed: Performed = {
    summary: "Delivered to Lan",
    evidence: "captured",
    href: "/leads/lead-1",
    lead_id: "lead-1",
    detail: "Thank you",
}

const build = async () => {
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    kit.scope.mockReturnValue({ workspaceId: "ws-1", locale: "en" })
    kit.leadInput.mockReturnValue({ contact_name: "Lan", company: "Hue Tea", channel: "zalo", need: "wholesale" })
    kit.brief.mockResolvedValue("brief")
    const leads = mock<LeadRecordsService>()
    leads.require.mockResolvedValue(lead)
    const transactions = mock<TransactionsService>()
    const invoices = mock<InvoicesService>()
    const orders = mock<OrdersService>()
    const writer = mock<PromptWriter>()
    writer.draftCare.mockResolvedValue("Thank you")
    const delivery = mock<CustomerDeliveryService>()
    delivery.contactOf.mockResolvedValue("84901234567")
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            CarePerformerService,
            { provide: PerformerKitService, useValue: kit },
            { provide: LeadRecordsService, useValue: leads },
            { provide: TransactionsService, useValue: transactions },
            { provide: InvoicesService, useValue: invoices },
            { provide: OrdersService, useValue: orders },
            { provide: PROMPT_WRITER, useValue: writer },
            { provide: CustomerDeliveryService, useValue: delivery },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(CarePerformerService), transactions, invoices, orders, writer, delivery, logger }
}

describe("CarePerformerService prepare", () => {
    it("writes the thank-you from the paid transaction, its invoice and the goods", async () => {
        const { service, transactions, invoices, orders, writer } = await build()
        transactions.find.mockResolvedValue(transactionOf())
        invoices.find.mockResolvedValue(invoiceOf())
        orders.labelsOf.mockResolvedValue([{ id: "ord-1", order_no: "SO-1", items: "2 tea boxes" }])
        const item = itemOf({
            subject_type: "transaction",
            subject_id: "tx-1",
            proposal: { summary: "s", fields: { x: 1 } },
        })

        await expect(service.prepare(ctx, item)).resolves.toEqual({
            proposal: {
                summary: "careSummary|Lan",
                draft: "Thank you",
                fields: { x: 1, customer: "Lan", contact: "84901234567" },
            },
        })
        expect(writer.draftCare).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "en" },
            { contact_name: "Lan", company: "Hue Tea", channel: "zalo", need: "wholesale" },
            `2 tea boxes · INV-1 · ${formatVnd(450000, "en")}`,
            "brief",
        )
    })

    it("uses the invoice the proposal names without reading a transaction", async () => {
        const { service, transactions, invoices, writer } = await build()
        invoices.find.mockResolvedValue(invoiceOf({ id: "inv-2", invoice_no: "INV-2", order_id: null }))
        const item = itemOf({ proposal: { summary: "s", fields: { invoice_id: "inv-2" } } })

        await service.prepare(ctx, item)

        expect(transactions.find).not.toHaveBeenCalled()
        expect(invoices.find).toHaveBeenCalledWith("ws-1", "inv-2")
        expect(writer.draftCare.mock.calls[0]?.[2]).toBe(`INV-2 · ${formatVnd(450000, "en")}`)
    })

    it("names only the amount of a transaction that settled no invoice", async () => {
        const { service, transactions, invoices, writer } = await build()
        transactions.find.mockResolvedValue(transactionOf({ invoice_id: null }))

        await service.prepare(ctx, itemOf({ subject_type: "transaction", subject_id: "tx-1" }))

        expect(invoices.find).not.toHaveBeenCalled()
        expect(writer.draftCare.mock.calls[0]?.[2]).toBe(formatVnd(500000, "en"))
    })

    it("writes an empty note when the invoice the item is about is gone", async () => {
        const { service, invoices, writer } = await build()
        invoices.find.mockResolvedValue(null)

        await service.prepare(ctx, itemOf({ subject_type: "invoice", subject_id: "inv-9" }))

        expect(invoices.find).toHaveBeenCalledWith("ws-1", "inv-9")
        expect(writer.draftCare.mock.calls[0]?.[2]).toBe("")
    })
})

describe("CarePerformerService prepare when the model does not answer", () => {
    it("thanks with the filled template, marked, when the model fails, and the work goes on to the gate", async () => {
        const { service, invoices, writer, logger } = await build()
        invoices.find.mockResolvedValue(invoiceOf({ order_id: null }))
        const failure = new AiGenerationsError({ code: AiGenerationsErrorCode.GenerationFailed })
        writer.draftCare.mockRejectedValue(failure)
        const item = itemOf({ subject_type: "invoice", subject_id: "inv-1", proposal: { summary: "s", fields: {} } })

        const prepared = await service.prepare(ctx, item)

        const paid = `INV-1 · ${formatVnd(450000, "en")}`
        expect(prepared).toEqual({
            proposal: {
                summary: "fallbackSummary|careSummary|Lan",
                draft: `careFallback|Lan|${paid}`,
                fields: { customer: "Lan", contact: "84901234567" },
            },
        })
        expect(JSON.stringify(prepared)).not.toContain(AiGenerationsErrorCode.GenerationFailed)
        expect(logger.warn).toHaveBeenCalledWith(WorkPerformersLogEvent.CareDraftFallback, {
            workItemId: "item-1",
            cause: failure,
        })
    })

    it("falls back on a timeout or an empty answer, without a payment line when none is known", async () => {
        const { service, invoices, writer } = await build()
        invoices.find.mockResolvedValue(null)
        writer.draftCare.mockRejectedValueOnce(new RangeError("timeout")).mockResolvedValueOnce("  ")
        const item = itemOf({ subject_type: "invoice", subject_id: "inv-9" })

        const timedOut = await service.prepare(ctx, item)
        const empty = await service.prepare(ctx, item)

        expect(timedOut.proposal.draft).toBe("careFallbackPlain|Lan|")
        expect(empty.proposal).toMatchObject({
            draft: "careFallbackPlain|Lan|",
            summary: "fallbackSummary|careSummary|Lan",
        })
    })
})

describe("CarePerformerService prepare without a customer", () => {
    it("refuses an item without a customer", async () => {
        const { service } = await build()

        await expect(service.prepare(ctx, itemOf({ lead_id: null }))).rejects.toMatchObject({
            code: WorkPerformersErrorCode.SubjectMissing,
        })
    })
})

describe("CarePerformerService perform", () => {
    it("delivers the draft and leaves the care evidence", async () => {
        const { service, delivery } = await build()
        delivery.sendAndLog.mockResolvedValue(performed)
        const item = itemOf()

        await expect(
            service.perform(ctx, item, { summary: "s", draft: "Thank you", fields: {} }, { name: "Mai" }),
        ).resolves.toEqual(performed)
        expect(delivery.sendAndLog).toHaveBeenCalledWith(ctx, item, lead, "Thank you", { name: "Mai" }, "care.sent")
    })

    it("delivers the summary when there is no draft", async () => {
        const { service, delivery } = await build()
        delivery.sendAndLog.mockResolvedValue(performed)

        await service.perform(ctx, itemOf(), { summary: "Thanks Lan", fields: {} }, { name: "Mai" })

        expect(delivery.sendAndLog.mock.calls[0]?.[3]).toBe("Thanks Lan")
    })

    it("refuses an item without a customer", async () => {
        const { service } = await build()

        await expect(
            service.perform(ctx, itemOf({ lead_id: null }), { summary: "s", fields: {} }, { name: "Mai" }),
        ).rejects.toMatchObject({ code: WorkPerformersErrorCode.SubjectMissing })
    })
})
