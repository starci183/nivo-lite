import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { LeadRecordsService } from "@modules/domain/leads"
import { DealWonEvent, OrderConfirmedEvent, whenPresent } from "@modules/events/api"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import type { OptionalOrder, SalesOrderRow } from "./orders.contracts"
import { OrdersService } from "./orders.service"

/** What confirming a draft order takes. */
export interface OrderConfirmationInput {
    /** The workspace of the order. */
    readonly workspaceId: string
    /** The draft order. */
    readonly orderId: string
    /** The amount the order is confirmed at, VND, or null. */
    readonly amountVnd: number | null
    /** What was ordered, as confirmed. */
    readonly items: string
    /** The display name of the confirmer. */
    readonly confirmedBy: string
    /** The customer's name for the events when the order has no customer record to read it from. */
    readonly customer: string
}

/** Work done inside the confirming transaction, after the order is confirmed and before the events go out. */
export type WithinConfirmation = (order: SalesOrderRow, transaction: EntityManager) => Promise<void>

@Injectable()
/**
 * The one way an order is confirmed, for the work engine's performer and for a graph node alike: the draft is confirmed once (a repeat
 * changes nothing), the deal is marked won, and `order_confirmed` and `deal_won` go out through the outbox in the same transaction, so
 * the reactors listening for them fire whoever confirmed.
 */
export class OrderConfirmationService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly orders: OrdersService,
        private readonly leads: LeadRecordsService,
        @InjectEventBus() private readonly bus: EventBus,
    ) {}

    /** Confirms the draft and publishes; null when the order is no longer a draft, so a repeat confirms and publishes nothing. */
    confirm(input: OrderConfirmationInput, within?: WithinConfirmation): Promise<OptionalOrder> {
        return this.entityManager.transaction(async (tx) => {
            const order = await this.orders.confirm(
                {
                    workspaceId: input.workspaceId,
                    orderId: input.orderId,
                    amountVnd: input.amountVnd,
                    items: input.items,
                    confirmedBy: input.confirmedBy,
                },
                tx,
            )
            if (order === null) return null
            if (order.lead_id !== null) await this.leads.markWon(input.workspaceId, order.lead_id, tx)
            await within?.(order, tx)
            await this.publish(input, order, tx)
            return order
        })
    }

    /** `order_confirmed` for the order, and `deal_won` for its customer when it has one: the reactors listening hear them once committed. */
    private async publish(input: OrderConfirmationInput, order: SalesOrderRow, tx: EntityManager): Promise<void> {
        const buyer = order.lead_id === null ? null : await this.leads.find(input.workspaceId, order.lead_id)
        const customer = buyer?.contact_name ?? input.customer
        await this.bus.publish(
            OrderConfirmedEvent.create({
                workspaceId: input.workspaceId,
                orderId: order.id,
                orderNo: order.order_no,
                ...whenPresent("leadId", order.lead_id),
                customer,
                items: input.items,
                ...whenPresent("amountVnd", input.amountVnd),
                ...whenPresent("channel", buyer?.channel),
                confirmedBy: input.confirmedBy,
            }),
            tx,
            `order_confirmed:${order.id}`,
        )
        if (order.lead_id === null) return
        await this.bus.publish(
            DealWonEvent.create({
                workspaceId: input.workspaceId,
                leadId: order.lead_id,
                name: customer,
                ...whenPresent("company", buyer?.company),
                ...whenPresent("channel", buyer?.channel),
                ...whenPresent("need", buyer?.need),
                orderNo: order.order_no,
                ...whenPresent("amountVnd", input.amountVnd),
            }),
            tx,
            `deal_won:${order.lead_id}`,
        )
    }
}
