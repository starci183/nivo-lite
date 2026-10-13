import { Injectable } from "@nestjs/common"
import {
    isBusinessEventPayload,
    isPaymentReceiptEventPayload,
    isShipmentEventPayload,
} from "@modules/queues/automation"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationsService } from "./automations.service"

@Injectable()
/** Dispatches an existing tick job to the scheduled engine pass, a durable shipment event, a business event or a payment receipt. */
export class AutomationTickService {
    constructor(
        private readonly engine: AutomationEngineService,
        private readonly automations: AutomationsService,
    ) {}

    /**
     * Validates a shipment payload, rechecks membership and emits it; a business event reaches the engine under its name; a payment
     * receipt starts the receipt pipeline; an ordinary scheduler payload runs the tick.
     */
    async run(payload: unknown): Promise<void> {
        if (isBusinessEventPayload(payload)) {
            await this.engine.onBusinessEvent({
                workspaceId: payload.workspaceId,
                event: payload.event,
                dedupe: payload.dedupe,
                data: payload.data,
            })
            return
        }
        if (isPaymentReceiptEventPayload(payload)) {
            await this.engine.startPaymentReceipt(payload.workspaceId, payload.transactionId, payload.invoiceId)
            return
        }
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
