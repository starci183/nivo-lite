import { CommandHandler } from "@nestjs/cqrs"
import { InventoryReplenishService } from "@modules/domain/inventory"
import type { DraftLowStockOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DraftInventoryLowStockCommand } from "./draft-inventory-low-stock.command"

@CommandHandler(DraftInventoryLowStockCommand)
/** Draft purchase orders for the items at or below their reorder point. */
export class DraftInventoryLowStockHandler extends ICQRSHandler<DraftInventoryLowStockCommand, DraftLowStockOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly replenish: InventoryReplenishService,
    ) {
        super(logger)
    }

    protected override process(command: DraftInventoryLowStockCommand): Promise<DraftLowStockOutput> {
        return this.replenish.draftLowStock(command.params.principal.id, command.params.request.workspaceId)
    }
}
