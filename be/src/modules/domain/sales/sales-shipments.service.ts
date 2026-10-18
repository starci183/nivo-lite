import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EvidenceService } from "@modules/domain/decisions"
import { OrdersService, OrdersError, OrdersErrorCode } from "@modules/domain/orders"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { AUTOMATION_QUEUE, AUTOMATION_TICK_JOB } from "@modules/queues/automation"
import type { ShipmentEventPayload } from "@modules/queues/automation"
import type { SalesShipment, SalesShipmentRequest } from "./sales.contracts"
import { SalesStatusService } from "./sales-status.service"

@Injectable()
/** Records a shipment with its evidence and durable delivery automation notification in one transaction. */
export class SalesShipmentsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly members: WorkspaceMembersService,
        private readonly orders: OrdersService,
        private readonly evidence: EvidenceService,
        private readonly status: SalesStatusService,
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
            const payload: ShipmentEventPayload = {
                kind: "shipment",
                workspaceId: request.workspaceId,
                userId: principalId,
                orderId: order.id,
                orderNo: order.order_no,
                leadId: order.lead_id,
                carrier,
                trackingCode,
                shippedAt: order.shipped_at,
            }
            const dedupeKey = `order.shipped:${order.id}`
            await this.outbox.write(tx, AUTOMATION_QUEUE, payload, { job: AUTOMATION_TICK_JOB, dedupeKey })
            const action = await this.status.queued(tx, request.workspaceId, dedupeKey)
            return { id: order.id, orderNo: order.order_no, notificationId: action.id }
        })
    }
}
