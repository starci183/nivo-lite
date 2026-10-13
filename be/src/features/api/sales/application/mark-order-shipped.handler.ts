import { CommandHandler } from "@nestjs/cqrs"
import { SalesShipmentsService } from "@modules/domain/sales"
import type { SalesShipment } from "@modules/domain/sales"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MarkOrderShippedCommand } from "./mark-order-shipped.command"

@CommandHandler(MarkOrderShippedCommand)
/** Records an order shipment. */
export class MarkOrderShippedHandler extends ICQRSHandler<MarkOrderShippedCommand, SalesShipment> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sales: SalesShipmentsService,
    ) {
        super(logger)
    }

    protected override process(command: MarkOrderShippedCommand): Promise<SalesShipment> {
        return this.sales.markShipped(command.params.principal.id, command.params.request)
    }
}
