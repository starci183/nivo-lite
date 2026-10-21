import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { CustomerTurn } from "@modules/domain/conversations"
import { WorkEngineService, formatVnd } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { InvoiceRow } from "@modules/domain/invoices"
import { OrdersService } from "@modules/domain/orders"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { OPEN_ORDER_STATUSES, sameItems } from "./customer-turn.policy"
import type { CapturedOrder, CustomerChannel, OrderRequest, TurnSettled } from "./customer-turns.contracts"
import { PaymentClaimsService } from "./payment-claims.service"

@Injectable()
/**
 * What a customer buys or says they paid in a chat: an order of a listed item becomes one order input per message and runs the same
 * order work as any other order (Sales confirm, then Accounting's invoice); "I have paid" an open invoice becomes one payment input per
 * message and one check per invoice that waits for the owner. A customer's claim is never evidence of payment.
 */
export class TurnPurchasesService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly engine: WorkEngineService,
        private readonly inbound: InboundEventsService,
        private readonly orders: OrdersService,
        private readonly conversations: AgentConversationsService,
        private readonly claims: PaymentClaimsService,
    ) {}

    /** A clear purchase of a listed item is one order input per message; the same item again while its order is open is not a second order. */
    async recordOrder(ctx: WorkContext, turn: CustomerTurn, request: OrderRequest): Promise<TurnSettled> {
        const { reply, order, channel, leadId } = request
        if (order === null) return { lines: [], changed: false, leadId }
        const lead = reply.lead
        const recorded = await this.inbound.recordInput({
            workspaceId: ctx.workspaceId,
            channel: channel.key,
            kind: "order",
            senderName: lead?.contactName ?? turn.conversation.visitorName,
            senderContact: lead === null ? null : (lead.phone ?? lead.email),
            body: turn.body,
            externalRef: null,
            eventId: `${turn.channelEventId}:order`,
        })
        if (recorded.duplicate) return { lines: [], changed: false, leadId }
        if (leadId !== null && (await this.hasOpenOrder(ctx.workspaceId, leadId, order))) {
            await this.inbound.mark(ctx.workspaceId, recorded.inboundEventId, "processed", leadId)
            return { lines: [], changed: false, leadId }
        }
        const item = await this.engine.startOrderWork(
            ctx,
            { id: recorded.inboundEventId },
            { items: order.items, amount_vnd: order.amountVnd, lead_id: leadId },
        )
        const ordered = item.lead_id ?? leadId
        if (leadId === null && item.lead_id !== null) {
            await this.conversations.attachLead(ctx.workspaceId, turn.conversation.id, item.lead_id)
        }
        return {
            lines: [this.text("orderRecorded", { items: order.items, amount: formatVnd(order.amountVnd, ctx.locale) })],
            changed: true,
            leadId: ordered,
        }
    }

    private async hasOpenOrder(workspaceId: string, leadId: string, order: CapturedOrder): Promise<boolean> {
        const orders = await this.orders.listForLead(workspaceId, leadId)
        return orders.some(
            (open) =>
                OPEN_ORDER_STATUSES.has(open.status) &&
                open.amount_vnd === order.amountVnd &&
                sameItems(open.items, order.items),
        )
    }

    /** "I have paid" an open invoice: one payment input per message, and one check per invoice that waits for the owner. */
    async recordClaim(
        ctx: WorkContext,
        turn: CustomerTurn,
        invoice: InvoiceRow | null,
        channel: CustomerChannel,
    ): Promise<TurnSettled> {
        if (invoice === null) return { lines: [], changed: false, leadId: null }
        const recorded = await this.inbound.recordInput({
            workspaceId: ctx.workspaceId,
            channel: channel.key,
            kind: "payment",
            senderName: turn.conversation.visitorName,
            senderContact: null,
            body: turn.body,
            externalRef: invoice.invoice_no,
            eventId: `${turn.channelEventId}:payment`,
        })
        if (recorded.duplicate) return { lines: [], changed: false, leadId: null }
        const started = await this.claims.start(ctx, invoice, {
            inboundEventId: recorded.inboundEventId,
            claim: turn.body,
            channelLabel: channel.label,
            conversationId: turn.conversation.id,
        })
        if (!started.created) {
            // A repeated claim joins the check already open: the input is handled, nothing new to decide.
            await this.inbound.mark(ctx.workspaceId, recorded.inboundEventId, "processed", invoice.lead_id)
            return { lines: [], changed: false, leadId: null }
        }
        return { lines: [this.text("claimRecorded", { no: invoice.invoice_no })], changed: true, leadId: null }
    }

    private text(key: string, params: Readonly<Record<string, string>>): string {
        return this.catalog.get(`customerTurns.${key}`, params, "vi")
    }
}
