import { Injectable } from "@nestjs/common"
import { isShipmentEventPayload } from "@modules/queues/automation"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationsService } from "./automations.service"

@Injectable()
/** Dispatches an existing tick job to the scheduled engine pass or a durable shipment event. */
export class AutomationTickService {
    constructor(
        private readonly engine: AutomationEngineService,
        private readonly automations: AutomationsService,
    ) {}

    /** Validates a shipment payload, rechecks membership and emits it; an ordinary scheduler payload runs the tick. */
    async run(payload: unknown): Promise<void> {
        if (isShipmentEventPayload(payload)) {
            await this.automations.emit(payload.userId, payload.workspaceId, {
                event: "order.shipped",
                dedupe: `order.shipped:${payload.orderId}`,
                data: {
                    order_id: payload.orderId,
                    order_no: payload.orderNo,
                    lead_id: payload.leadId,
                    carrier: payload.carrier,
                    tracking_code: payload.trackingCode,
                    shipped_at: payload.shippedAt,
                },
            })
            return
        }
        await this.engine.tickNow()
    }
}
