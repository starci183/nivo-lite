import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WebhookEventsService } from "@modules/domain/webhook-connections"
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
import {
    dealWonReaction,
    decisionMadeReaction,
    orderConfirmedReaction,
    paymentReceivedReaction,
} from "./automation-reactions.mapper"
import type { Reaction } from "./automation-reactions.mapper"

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
        return this.entityManager.transaction((tx) => this.startLeadPipelines(delivery, tx))
    }

    /** `deal.won` for the pipelines and the webhooks. */
    onDealWon(delivery: EventDelivery<DealWonEvent>): Promise<void> {
        return this.entityManager.transaction((tx) => this.react(delivery, tx, dealWonReaction))
    }

    /** `decision.made`: the automation run that waited for the item settles, and the webhooks hear the decision. */
    onDecisionMade(delivery: EventDelivery<DecisionMadeEvent>): Promise<void> {
        return this.entityManager.transaction((tx) => this.react(delivery, tx, decisionMadeReaction))
    }

    /** `payment.received` for the pipelines (thank-you, review request, sheet) and the webhooks. */
    onPaymentReconciled(delivery: EventDelivery<PaymentReconciledEvent>): Promise<void> {
        return this.entityManager.transaction((tx) => this.react(delivery, tx, paymentReceivedReaction))
    }

    /** The customer's receipt by email for the settled payment, when the shop switched the receipt pipeline on. */
    onPaymentReceipt(delivery: EventDelivery<PaymentReconciledEvent>): Promise<void> {
        return this.entityManager.transaction((tx) => this.startReceipt(delivery, tx))
    }

    /** `order.confirmed` for the pipelines and the webhooks. */
    onOrderConfirmed(delivery: EventDelivery<OrderConfirmedEvent>): Promise<void> {
        return this.entityManager.transaction((tx) => this.react(delivery, tx, orderConfirmedReaction))
    }

    /** `order.shipped` for the pipelines, after the member who recorded the shipment is checked again. */
    onOrderShipped(delivery: EventDelivery<OrderShippedEvent>): Promise<void> {
        return this.entityManager.transaction((tx) => this.emitShipment(delivery, tx))
    }

    /** Claims the new lead, then starts the pipelines that listen for it. */
    private async startLeadPipelines(delivery: EventDelivery<LeadCapturedEvent>, tx: EntityManager): Promise<void> {
        if (!(await this.inbox.claim(delivery.consumer, delivery.dedupeKey, tx))) return
        const lead = delivery.event.payload
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
    }

    /** Claims the settled payment, then starts the receipt pipeline for it. */
    private async startReceipt(delivery: EventDelivery<PaymentReconciledEvent>, tx: EntityManager): Promise<void> {
        if (!(await this.inbox.claim(delivery.consumer, delivery.dedupeKey, tx))) return
        const payment = delivery.event.payload
        await this.engine.startPaymentReceipt(payment.workspaceId, payment.transactionId ?? null, payment.invoiceId)
    }

    /** Claims the shipment, then emits it to the pipelines as the member who recorded it. */
    private async emitShipment(delivery: EventDelivery<OrderShippedEvent>, tx: EntityManager): Promise<void> {
        if (!(await this.inbox.claim(delivery.consumer, delivery.dedupeKey, tx))) return
        const shipment = delivery.event.payload
        await this.automations.emit(shipment.userId, shipment.workspaceId, {
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
        })
    }

    /** Claims the delivery in the inbox inside the transaction, then publishes the reaction the payload maps to; a repeat does nothing. */
    private async react<Event extends BaseEvent>(
        delivery: EventDelivery<Event>,
        tx: EntityManager,
        reaction: (payload: Event["payload"], dedupe: string) => Reaction,
    ): Promise<void> {
        if (!(await this.inbox.claim(delivery.consumer, delivery.dedupeKey, tx))) return
        await this.publish(tx, reaction(delivery.event.payload, delivery.dedupeKey))
    }

    /** The pipelines hear the event and the subscribed webhooks get their delivery job, in the transaction of the inbox claim. */
    private async publish(manager: EntityManager, reaction: Reaction): Promise<void> {
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
    }
}
