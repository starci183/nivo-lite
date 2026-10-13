import { CommandHandler } from "@nestjs/cqrs"
import { InventoryStockService } from "@modules/domain/inventory"
import type { StockTakeOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TakeInventoryStockCommand } from "./take-inventory-stock.command"

@CommandHandler(TakeInventoryStockCommand)
/** Apply a stock count. */
export class TakeInventoryStockHandler extends ICQRSHandler<TakeInventoryStockCommand, StockTakeOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly stock: InventoryStockService,
    ) {
        super(logger)
    }

    protected override process(command: TakeInventoryStockCommand): Promise<StockTakeOutput> {
        return this.stock.stockTake(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
