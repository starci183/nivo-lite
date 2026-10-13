import { Injectable } from "@nestjs/common"
import { EvidenceService } from "@modules/domain/decisions"
import type {
    Performed,
    PerformedBy,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
} from "@modules/domain/decisions"
import { InvoicesService } from "@modules/domain/invoices"
import type { InvoiceRow } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PaymentInstructionsService } from "./payment-instructions.service"
import { PerformerKitService } from "./performer-kit.service"
import { leadHref, numberOf } from "./performer.policy"
import { WorkPerformersLogEvent } from "./work-performers.log-events"

@Injectable()
/** `issue_invoice`: Accounting issues the internal payment record of a confirmed order (one per order) and, for a live Telegram customer, sends the payment instructions. */
export class IssueInvoicePerformer implements WorkPerformer {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly kit: PerformerKitService,
        private readonly invoices: InvoicesService,
        private readonly orders: OrdersService,
        private readonly leads: LeadRecordsService,
        private readonly instructions: PaymentInstructionsService,
        private readonly evidence: EvidenceService,
    ) {}

    /** The summary and amount: from the order when the item is about one, else from the customer and the proposal. */
    async prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const fields = item.proposal.fields
        if (item.subject_type === "order" && item.subject_id !== null) {
            const order = await this.orders.find(ctx.workspaceId, item.subject_id)
            if (order === null) throw new WorkPerformersError({ code: WorkPerformersErrorCode.OrderUnavailable })
            const lead = order.lead_id === null ? null : await this.leads.find(ctx.workspaceId, order.lead_id)
            const name = lead?.contact_name ?? ""
            return {
                proposal: {
                    summary: this.kit.text(ctx, "invoiceSummary", {
                        name,
                        amount: this.kit.money(ctx, order.amount_vnd),
                    }),
                    amount_vnd: order.amount_vnd,
                    fields: {
                        customer: name === "" ? null : name,
                        amount_vnd: order.amount_vnd,
                        order_no: order.order_no,
                    },
                },
                patch: { lead_id: order.lead_id },
            }
        }
        if (item.lead_id === null) throw new WorkPerformersError({ code: WorkPerformersErrorCode.SubjectMissing })
        const lead = await this.leads.require(ctx.workspaceId, item.lead_id)
        const amount =
            typeof item.proposal.amount_vnd === "number" ? item.proposal.amount_vnd : numberOf(fields.amount_vnd)
        return {
            proposal: {
                summary: this.kit.text(ctx, "invoiceSummary", {
                    name: lead.contact_name,
                    amount: this.kit.money(ctx, amount),
                }),
                amount_vnd: amount,
                fields: { ...fields, customer: lead.contact_name, amount_vnd: amount },
            },
        }
    }

    /** Issues the invoice under the next number; an order that has one already gets no second. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const orderId = item.subject_type === "order" ? item.subject_id : null
        const amount = proposal.amount_vnd ?? (Number(proposal.fields.amount_vnd) || 0)
        const { invoice, created } = await this.invoices.issue({
            workspaceId: ctx.workspaceId,
            orderId,
            leadId: item.lead_id,
            amountVnd: amount,
            origin: item.origin,
            issuedBy: by.name,
        })
        if (!created) {
            const summary = this.kit.text(ctx, "invoiceExists", { no: invoice.invoice_no })
            return { summary, evidence: "captured", href: leadHref(invoice.lead_id), lead_id: invoice.lead_id }
        }
        if (orderId !== null) await this.orders.markInvoiced(ctx.workspaceId, orderId)
        const summary = this.kit.text(ctx, "invoiceIssued", {
            no: invoice.invoice_no,
            amount: this.kit.money(ctx, invoice.amount_vnd),
            label: this.kit.text(ctx, "internalInvoice"),
        })
        await this.evidence.log(ctx, {
            lead_id: invoice.lead_id,
            work_item_id: item.id,
            kind: "invoice.issued",
            actor: by.name,
            summary,
        })
        const sent = item.origin === "live" ? await this.instruct(ctx, item, invoice) : null
        return {
            summary,
            evidence: "captured",
            href: leadHref(invoice.lead_id),
            lead_id: invoice.lead_id,
            detail: sent,
        }
    }

    /** The record stands even when the instructions cannot be delivered. */
    private async instruct(ctx: WorkContext, item: WorkItem, invoice: InvoiceRow): Promise<string | null> {
        try {
            return await this.instructions.send(ctx, item, invoice)
        } catch (cause) {
            this.logger.error(WorkPerformersLogEvent.InstructionsFailed, cause, { workItemId: item.id })
            return null
        }
    }
}
