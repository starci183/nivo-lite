import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EvidenceService } from "@modules/domain/decisions"
import { OrdersService, OrdersError, OrdersErrorCode } from "@modules/domain/orders"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { OrderShippedEvent } from "@modules/events/api"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import type { SalesShipment, SalesShipmentRequest } from "./sales.contracts"

@Injectable()
/** Records a shipment with its evidence and the `order_shipped` fact in one transaction. */
export class SalesShipmentsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectEventBus() private readonly bus: EventBus,
        private readonly members: WorkspaceMembersService,
        private readonly orders: OrdersService,
        private readonly evidence: EvidenceService,
    ) {}

    /** Any active member may hand an eligible order to its carrier once. */
    async markShipped(principalId: string, request: SalesShipmentRequest): Promise<SalesShipment> {
        const member = await this.members.require(principalId, request.workspaceId)
        const carrier = request.carrier.trim()
        const trackingCode = request.trackingCode.trim()
        if (carrier.length === 0 || trackingCode.length === 0 || carrier.length > 80 || trackingCode.length > 80) {
            throw new OrdersError({ code: OrdersErrorCode.ShipmentInvalid })
        }
        return this.entityManager.transaction(async (tx) => {
            const order = await this.orders.ship(request.workspaceId, request.orderId, carrier, trackingCode, tx)
            if (order?.shipped_at === undefined || order.shipped_at === null)
                throw new OrdersError({ code: OrdersErrorCode.NotShippable })
            await this.evidence.log(
                { workspaceId: request.workspaceId, actor: member.displayName, locale: request.locale },
                {
                    lead_id: order.lead_id,
                    kind: "order.shipped",
                    actor: member.displayName,
                    summary: this.catalog.get(
                        "sales.shipped",
                        { who: member.displayName, no: order.order_no, carrier },
                        request.locale,
                    ),
                    evidence: trackingCode,
                },
                tx,
            )
            await this.bus.publish(
                OrderShippedEvent.create({
                    workspaceId: request.workspaceId,
                    userId: principalId,
                    orderId: order.id,
                    orderNo: order.order_no,
                    leadId: order.lead_id,
                    carrier,
                    trackingCode,
                    shippedAt: order.shipped_at,
                }),
                tx,
                `order_shipped:${order.id}`,
            )
            return { id: order.id, orderNo: order.order_no, notificationId: order.id }
        })
    }
}
