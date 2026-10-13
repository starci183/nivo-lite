import type { SalesShipment, SalesShipmentRequest } from "@modules/domain/sales"
import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Records an order shipment. */
export class MarkOrderShippedCommand extends Command<SalesShipment> {
    constructor(readonly params: ExecuteParams<SalesShipmentRequest>) {
        super()
    }
}
