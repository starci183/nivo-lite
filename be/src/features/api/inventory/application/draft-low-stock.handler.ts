import { CommandHandler } from "@nestjs/cqrs"
import { InventoryReplenishService } from "@modules/domain/inventory"
import type { DraftLowStockOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DraftLowStockCommand } from "./draft-low-stock.command"

@CommandHandler(DraftLowStockCommand)
/** Handles draft purchase orders for low items through one domain-service call. */
export class DraftLowStockHandler extends ICQRSHandler<DraftLowStockCommand, DraftLowStockOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryReplenishService: InventoryReplenishService,
    ) {
        super(logger)
    }

    protected override process(command: DraftLowStockCommand): Promise<DraftLowStockOutput> {
        return this.inventoryReplenishService.draftLowStock(
            command.params.principal.id,
            command.params.request.workspaceId,
        )
    }
}
