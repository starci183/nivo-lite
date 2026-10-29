import type { WebhookEvent } from "@modules/domain/webhook-connections"
import type {
    DealWonEvent,
    DecisionMadeEvent,
    OrderConfirmedEvent,
    PaymentReconciledEvent,
} from "@modules/events/api"
import type { EventData } from "./automations.contracts"

/** One business event a reactor hands the automation engine, with the webhooks that may hear it. */
export interface Reaction {
    /** The legacy event name the pipelines and webhooks listen to, for example `payment.received`. */
    readonly event: WebhookEvent
    /** The workspace whose pipelines hear it. */
    readonly workspaceId: string
    /** The occurrence key: the same key never starts a run or a delivery twice. */
    readonly dedupe: string
    /** What the event carries. */
    readonly data: EventData
}

/** The `deal.won` reaction of a won deal, keyed by the delivery. */
export function dealWonReaction(deal: DealWonEvent["payload"], dedupe: string): Reaction {
    return {
        event: "deal.won",
        workspaceId: deal.workspaceId,
        dedupe,
        data: {
            lead_id: deal.leadId,
            name: deal.name,
            company: deal.company ?? null,
            channel: deal.channel ?? null,
            need: deal.need ?? null,
            ...(deal.orderNo === undefined ? {} : { order_no: deal.orderNo }),
            ...(deal.amountVnd === undefined ? {} : { amount_vnd: deal.amountVnd }),
            ...(deal.source === undefined ? {} : { source: deal.source }),
            ...(deal.evidence === undefined ? {} : { evidence: deal.evidence }),
        },
    }
}

/** The `decision.made` reaction of a decided work item, keyed by the delivery. */
export function decisionMadeReaction(decision: DecisionMadeEvent["payload"], dedupe: string): Reaction {
    return {
        event: "decision.made",
        workspaceId: decision.workspaceId,
        dedupe,
        data: {
            work_item_id: decision.workItemId,
            action: decision.action,
            department: decision.department,
            outcome: decision.outcome,
            decided_by: decision.decidedBy,
            lead_id: decision.leadId ?? null,
            summary: decision.summary,
        },
    }
}

/** The `payment.received` reaction of a settled payment, keyed by its invoice. */
export function paymentReceivedReaction(payment: PaymentReconciledEvent["payload"]): Reaction {
    return {
        event: "payment.received",
        workspaceId: payment.workspaceId,
        dedupe: `payment.received:${payment.invoiceId}`,
        data: {
            invoice_id: payment.invoiceId,
            transaction_id: payment.transactionId ?? null,
            invoice_no: payment.invoiceNo,
            order_id: payment.orderId ?? null,
            order_no: payment.orderNo ?? null,
            lead_id: payment.leadId ?? null,
            customer: payment.customer,
            amount_vnd: payment.amountVnd ?? null,
            paid_at: payment.paidAt ?? null,
            channel: payment.channel ?? null,
        },
    }
}

/** The `order.confirmed` reaction of a confirmed order, keyed by the order. */
export function orderConfirmedReaction(order: OrderConfirmedEvent["payload"]): Reaction {
    return {
        event: "order.confirmed",
        workspaceId: order.workspaceId,
        dedupe: `order.confirmed:${order.orderId}`,
        data: {
            order_id: order.orderId,
            order_no: order.orderNo,
            lead_id: order.leadId,
            customer: order.customer,
            items: order.items,
            amount_vnd: order.amountVnd,
            channel: order.channel,
            confirmed_by: order.confirmedBy,
            status: "confirmed",
        },
    }
}
