import { CommandHandler } from "@nestjs/cqrs"
import { InventoryStockService } from "@modules/domain/inventory"
import type { StockTakeOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StockTakeCommand } from "./stock-take.command"

@CommandHandler(StockTakeCommand)
/** Handles apply a stock count through one domain-service call. */
export class StockTakeHandler extends ICQRSHandler<StockTakeCommand, StockTakeOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryStockService: InventoryStockService,
    ) {
        super(logger)
    }

    protected override process(command: StockTakeCommand): Promise<StockTakeOutput> {
        return this.inventoryStockService.stockTake(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
