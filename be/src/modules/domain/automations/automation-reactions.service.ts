import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WebhookEventsService } from "@modules/domain/webhook-connections"
import type { WebhookEvent } from "@modules/domain/webhook-connections"
import type {
    DealWonEvent,
    DecisionMadeEvent,
    LeadCapturedEvent,
    OrderConfirmedEvent,
    OrderShippedEvent,
    PaymentReconciledEvent,
} from "@modules/events/api"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BaseEvent, EventDelivery } from "@modules/platform/event-bus"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationsService } from "./automations.service"
import type { EventData } from "./automations.contracts"

/** One business event a reactor hands the automation engine, with the webhooks that may hear it. */
interface Reaction {
    /** The legacy event name the pipelines and webhooks listen to, for example `payment.received`. */
    readonly event: WebhookEvent
    /** The workspace whose pipelines hear it. */
    readonly workspaceId: string
    /** The occurrence key: the same key never starts a run or a delivery twice. */
    readonly dedupe: string
    /** What the event carries. */
    readonly data: EventData
}

@Injectable()
/**
 * What the automations capability does when a business fact reaches it on the event bus: the pipelines that listen start (or a
 * waiting run settles) through the engine, and the connected webhooks that picked the event get a signed delivery on the n8n job
 * queue. Each reaction claims `(consumer, dedupeKey)` in the inbox inside the transaction of its effect, so a redelivery changes
 * nothing twice; the engine's own dedupe keys keep a repeat from starting a run twice as well.
 */
export class AutomationReactionsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInbox() private readonly inbox: Inbox,
        private readonly engine: AutomationEngineService,
        private readonly automations: AutomationsService,
        private readonly webhooks: WebhookEventsService,
    ) {}

    /** `lead.created` for the pipelines; a new lead has no webhook delivery today. */
    onLeadCaptured(delivery: EventDelivery<LeadCapturedEvent>): Promise<void> {
        const lead = delivery.event.payload
        return this.react(delivery, async () => {
            await this.engine.onBusinessEvent({
                workspaceId: lead.workspaceId,
                event: "lead.created",
                dedupe: delivery.dedupeKey,
                data: {
                    lead_id: lead.leadId,
                    name: lead.contactName,
                    company: lead.company,
                    channel: lead.channel,
                    need: lead.need,
                    phone: lead.phone ?? null,
                    email: lead.email ?? null,
                },
            })
        })
    }

    /** `deal.won` for the pipelines and the webhooks. */
    onDealWon(delivery: EventDelivery<DealWonEvent>): Promise<void> {
        const deal = delivery.event.payload
        return this.publish(delivery, {
            event: "deal.won",
            workspaceId: deal.workspaceId,
            dedupe: delivery.dedupeKey,
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
        })
    }

    /** `decision.made`: the automation run that waited for the item settles, and the webhooks hear the decision. */
    onDecisionMade(delivery: EventDelivery<DecisionMadeEvent>): Promise<void> {
        const decision = delivery.event.payload
        return this.publish(delivery, {
            event: "decision.made",
            workspaceId: decision.workspaceId,
            dedupe: delivery.dedupeKey,
            data: {
                work_item_id: decision.workItemId,
                action: decision.action,
                department: decision.department,
                outcome: decision.outcome,
                decided_by: decision.decidedBy,
                lead_id: decision.leadId ?? null,
                summary: decision.summary,
            },
        })
    }

    /** `payment.received` for the pipelines (thank-you, review request, sheet) and the webhooks. */
    onPaymentReconciled(delivery: EventDelivery<PaymentReconciledEvent>): Promise<void> {
        const payment = delivery.event.payload
        return this.publish(delivery, {
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
        })
    }

    /** The customer's receipt by email for the settled payment, when the shop switched the receipt pipeline on. */
    onPaymentReceipt(delivery: EventDelivery<PaymentReconciledEvent>): Promise<void> {
        const payment = delivery.event.payload
        return this.react(delivery, () =>
            this.engine.startPaymentReceipt(payment.workspaceId, payment.transactionId ?? null, payment.invoiceId),
        )
    }

    /** `order.confirmed` for the pipelines and the webhooks. */
    onOrderConfirmed(delivery: EventDelivery<OrderConfirmedEvent>): Promise<void> {
        const order = delivery.event.payload
        return this.publish(delivery, {
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
        })
    }

    /** `order.shipped` for the pipelines, after the member who recorded the shipment is checked again. */
    onOrderShipped(delivery: EventDelivery<OrderShippedEvent>): Promise<void> {
        const shipment = delivery.event.payload
        return this.react(delivery, () =>
            this.automations.emit(shipment.userId, shipment.workspaceId, {
                event: "order.shipped",
                dedupe: `order.shipped:${shipment.orderId}`,
                data: {
                    order_id: shipment.orderId,
                    order_no: shipment.orderNo,
                    lead_id: shipment.leadId,
                    carrier: shipment.carrier,
                    tracking_code: shipment.trackingCode,
                    shipped_at: shipment.shippedAt,
                },
            }),
        )
    }

    /** The pipelines hear the event and the subscribed webhooks get their delivery job, in the transaction of the inbox claim. */
    private publish(delivery: EventDelivery<BaseEvent>, reaction: Reaction): Promise<void> {
        return this.react(delivery, async (manager) => {
            await this.engine.onBusinessEvent({
                workspaceId: reaction.workspaceId,
                event: reaction.event,
                dedupe: reaction.dedupe,
                data: reaction.data,
            })
            await this.webhooks.publish(
                {
                    workspaceId: reaction.workspaceId,
                    event: reaction.event,
                    data: reaction.data,
                    dedupe: reaction.dedupe,
                },
                manager,
            )
        })
    }

    /** Runs the effect once per `(consumer, dedupeKey)`: the claim and the effect commit together or not at all. */
    private react(
        delivery: EventDelivery<BaseEvent>,
        effect: (manager: EntityManager) => Promise<void>,
    ): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            if (!(await this.inbox.claim(delivery.consumer, delivery.dedupeKey, manager))) return
            await effect(manager)
        })
    }
}
