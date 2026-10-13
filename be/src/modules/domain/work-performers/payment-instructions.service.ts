import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentsService } from "@modules/domain/agents"
import { EvidenceService, formatVnd } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import type { InvoiceRow } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { PerformerKitService } from "./performer-kit.service"
import { transferDetailsOf } from "./transfer-details.policy"

@Injectable()
/**
 * After an internal payment record is created for a customer who talks to us on Telegram: sends them the goods, the amount, the record
 * code (to put as the transfer content) and the owner's bank details from the business notes, or says the team will send them.
 */
export class PaymentInstructionsService {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly conversations: AgentConversationsService,
        private readonly agents: AgentsService,
        private readonly leads: LeadRecordsService,
        private readonly orders: OrdersService,
        private readonly delivery: CustomerDeliveryService,
        private readonly evidence: EvidenceService,
    ) {}

    /** Sends the instructions and answers the evidence sentence; null when the customer has no Telegram conversation to answer in. */
    async send(ctx: WorkContext, item: WorkItem, invoice: InvoiceRow): Promise<string | null> {
        if (invoice.lead_id === null) return null
        const conversation = await this.conversations.latestOfLead(ctx.workspaceId, invoice.lead_id, "telegram")
        if (conversation === null) return null
        const lead = await this.leads.find(ctx.workspaceId, invoice.lead_id)
        const [order] = invoice.order_id === null ? [] : await this.orders.labelsOf(ctx.workspaceId, [invoice.order_id])
        const profile =
            (await this.agents.profileOf(ctx.workspaceId, conversation.agentId)) ??
            (await this.agents.profileOfDepartment(ctx.workspaceId, "chatbot"))
        const details = transferDetailsOf(profile?.knowledge)
        const text = this.kit.text(ctx, "payInstructions", {
            items: order?.items === undefined || order.items === "" ? "—" : order.items,
            amount: formatVnd(invoice.amount_vnd, ctx.locale),
            no: invoice.invoice_no,
            transfer:
                details === null
                    ? this.kit.text(ctx, "payTransferLater")
                    : this.kit.text(ctx, "payTransferLine", { details }),
        })
        const sent = await this.delivery.inConversation(ctx.workspaceId, conversation.id, text)
        const summary = this.kit.text(ctx, sent ? "payInstructionsSent" : "payInstructionsFailed", {
            no: invoice.invoice_no,
            name: lead?.contact_name ?? conversation.visitorName ?? "—",
        })
        await this.evidence.log(ctx, {
            lead_id: invoice.lead_id,
            work_item_id: item.id,
            kind: sent ? "invoice.instructions_sent" : "invoice.instructions_failed",
            actor: await this.kit.department(ctx, "accounting"),
            summary,
            evidence: text,
        })
        return summary
    }
}
