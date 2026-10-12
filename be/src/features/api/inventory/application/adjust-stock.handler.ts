import { CommandHandler } from "@nestjs/cqrs"
import { InventoryStockService } from "@modules/domain/inventory"
import type { AdjustStockOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AdjustStockCommand } from "./adjust-stock.command"

@CommandHandler(AdjustStockCommand)
/** Handles change one item's quantity by hand through one domain-service call. */
export class AdjustStockHandler extends ICQRSHandler<AdjustStockCommand, AdjustStockOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryStockService: InventoryStockService,
    ) {
        super(logger)
    }

    protected override process(command: AdjustStockCommand): Promise<AdjustStockOutput> {
        return this.inventoryStockService.adjustStock(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
