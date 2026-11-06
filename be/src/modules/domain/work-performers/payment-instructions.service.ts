import { Injectable } from "@nestjs/common"
import { AgentsService } from "@modules/domain/agents"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { EvidenceService, formatVnd } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import type { InvoiceRow } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { PerformerKitService } from "./performer-kit.service"
import { conversationIdOf } from "./performer.policy"
import { transferDetailsOf } from "./transfer-details.policy"

/** The conversation channel the instructions go to. */
const TELEGRAM_CHANNEL = "telegram"

@Injectable()
/**
 * After an internal payment record is created in a Telegram conversation the work names: sends the customer the goods, the amount, the
 * record code (to put as the transfer content) and the owner's bank details from the business notes, or says the team will send them.
 */
export class PaymentInstructionsService {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly conversations: ChatConversationsService,
        private readonly agents: AgentsService,
        private readonly leads: LeadRecordsService,
        private readonly orders: OrdersService,
        private readonly delivery: CustomerDeliveryService,
        private readonly evidence: EvidenceService,
    ) {}

    /** Sends the instructions and answers the evidence sentence; null when the work names no Telegram conversation to answer in. */
    async send(ctx: WorkContext, item: WorkItem, invoice: InvoiceRow): Promise<string | null> {
        if (invoice.lead_id === null) return null
        const conversationId = conversationIdOf(item, item.proposal.fields)
        if (conversationId === null) return null
        const turn = await this.conversations.turnOf(ctx.workspaceId, conversationId)
        if (turn.kind !== "ok" || turn.value.channel !== TELEGRAM_CHANNEL) return null
        const conversation = turn.value
        const lead = await this.leads.find(ctx.workspaceId, invoice.lead_id)
        const [order] = invoice.order_id === null ? [] : await this.orders.labelsOf(ctx.workspaceId, [invoice.order_id])
        const profile =
            (await this.agents.profileOf(ctx.workspaceId, conversation.agent.id)) ??
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
        const sent = await this.delivery.inConversation(ctx.workspaceId, conversation.id, invoice.id, text)
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
