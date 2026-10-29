import { CommandHandler } from "@nestjs/cqrs"
import { InventoryDeductionService } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DeductConfirmedOrderCommand } from "./deduct-confirmed-order.command"

@CommandHandler(DeductConfirmedOrderCommand)
/** Hands the delivered order_confirmed event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class DeductConfirmedOrderHandler extends ICQRSHandler<DeductConfirmedOrderCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly deduction: InventoryDeductionService,
    ) {
        super(logger)
    }

    protected override process(command: DeductConfirmedOrderCommand): Promise<void> {
        return this.deduction.deductConfirmedOrder(
            command.params.request.delivery.consumer,
            command.params.request.delivery.dedupeKey,
            command.params.request.delivery.event.payload,
        )
    }
}
