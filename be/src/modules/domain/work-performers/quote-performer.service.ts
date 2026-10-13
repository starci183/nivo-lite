import { Injectable } from "@nestjs/common"
import type {
    Performed,
    PerformedBy,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
} from "@modules/domain/decisions"
import { LeadRecordsService } from "@modules/domain/leads"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"

@Injectable()
/** `send_quote`: the quote the owner approved (amount and text) is delivered to the customer. */
export class QuotePerformerService implements WorkPerformer {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly leads: LeadRecordsService,
        private readonly delivery: CustomerDeliveryService,
    ) {}

    /** The summary and the fields the owner reads; the amount comes from the proposal, never from a model. */
    async prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const lead = await this.leads.require(ctx.workspaceId, this.leadIdOf(item))
        const contact = await this.delivery.contactOf(ctx.workspaceId, lead)
        const amount = typeof item.proposal.amount_vnd === "number" ? item.proposal.amount_vnd : null
        const summary = this.kit.text(ctx, "quoteSummary", {
            name: lead.contact_name,
            amount: this.kit.money(ctx, amount),
        })
        return {
            proposal: {
                ...item.proposal,
                summary,
                amount_vnd: amount,
                fields: { ...item.proposal.fields, customer: lead.contact_name, contact, amount_vnd: amount },
            },
        }
    }

    /** Delivers the quote and leaves the evidence line. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const lead = await this.leads.require(ctx.workspaceId, this.leadIdOf(item))
        const text = proposal.draft ?? proposal.summary
        return this.delivery.sendAndLog(ctx, item, lead, text, by, "quote.sent")
    }

    private leadIdOf(item: WorkItem): string {
        if (item.lead_id === null) throw new WorkPerformersError({ code: WorkPerformersErrorCode.SubjectMissing })
        return item.lead_id
    }
}
