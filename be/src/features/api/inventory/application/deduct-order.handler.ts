import { CommandHandler } from "@nestjs/cqrs"
import { InventoryDeductionService } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DeductOrderCommand } from "./deduct-order.command"

@CommandHandler(DeductOrderCommand)
/** Handles take a confirmed order out of stock through one domain-service call. */
export class DeductOrderHandler extends ICQRSHandler<DeductOrderCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryDeductionService: InventoryDeductionService,
    ) {
        super(logger)
    }

    protected override process(command: DeductOrderCommand): Promise<void> {
        return this.inventoryDeductionService.enqueueDeduct(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
