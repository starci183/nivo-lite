import { Injectable } from "@nestjs/common"
import { formatVnd } from "@modules/domain/decisions"
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
import { LeadRecordsService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { TransactionsService } from "@modules/domain/transactions"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { InjectPromptWriter } from "./work-performers.decorators"
import type { PromptWriter } from "./work-performers.port"
import { PerformerKitService } from "./performer-kit.service"
import { dotted, textOf } from "./performer.policy"

@Injectable()
/** `send_care`: after the customer paid, the sales AI writes a short thank-you that names what was paid; once allowed it is delivered. */
export class CarePerformer implements WorkPerformer {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly leads: LeadRecordsService,
        private readonly transactions: TransactionsService,
        private readonly invoices: InvoicesService,
        private readonly orders: OrdersService,
        @InjectPromptWriter() private readonly deepseek: PromptWriter,
        private readonly delivery: CustomerDeliveryService,
    ) {}

    /** One model call: the thank-you, written from the item, the invoice and the amount that was paid. */
    async prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const lead = await this.leads.require(ctx.workspaceId, this.leadIdOf(item))
        const contact = await this.delivery.contactOf(ctx.workspaceId, lead)
        const base = item.proposal.fields
        const note = await this.paymentNote(ctx, item, textOf(base.invoice_id))
        const draft = await this.deepseek.draftCare(
            this.kit.scope(ctx),
            this.kit.leadInput(lead),
            note,
            await this.kit.brief(ctx),
        )
        return {
            proposal: {
                summary: this.kit.text(ctx, "careSummary", { name: lead.contact_name }),
                draft,
                fields: { ...base, customer: lead.contact_name, contact },
            },
        }
    }

    /** Delivers the message and leaves the evidence line. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const lead = await this.leads.require(ctx.workspaceId, this.leadIdOf(item))
        const text = proposal.draft ?? proposal.summary
        return this.delivery.sendAndLog(ctx, item, lead, text, by, "care.sent")
    }

    /** What was paid, as one line for the prompt: the goods, the invoice number and the amount. */
    private async paymentNote(ctx: WorkContext, item: WorkItem, namedInvoiceId: string): Promise<string> {
        const transaction =
            item.subject_type === "transaction" && item.subject_id !== null
                ? await this.transactions.find(ctx.workspaceId, item.subject_id)
                : null
        const invoiceId =
            namedInvoiceId !== ""
                ? namedInvoiceId
                : (transaction?.invoice_id ?? (item.subject_type === "invoice" ? item.subject_id : null))
        const invoice = invoiceId === null ? null : await this.invoices.find(ctx.workspaceId, invoiceId)
        const [order] =
            invoice?.order_id === undefined || invoice.order_id === null
                ? []
                : await this.orders.labelsOf(ctx.workspaceId, [invoice.order_id])
        const amount = invoice?.amount_vnd ?? transaction?.amount_vnd ?? null
        return dotted([order?.items, invoice?.invoice_no, amount === null ? "" : formatVnd(amount, ctx.locale)])
    }

    private leadIdOf(item: WorkItem): string {
        if (item.lead_id === null) throw new WorkPerformersError({ code: WorkPerformersErrorCode.SubjectMissing })
        return item.lead_id
    }
}
