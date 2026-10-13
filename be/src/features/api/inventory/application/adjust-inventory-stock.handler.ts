import { CommandHandler } from "@nestjs/cqrs"
import { InventoryStockService } from "@modules/domain/inventory"
import type { AdjustStockOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AdjustInventoryStockCommand } from "./adjust-inventory-stock.command"

@CommandHandler(AdjustInventoryStockCommand)
/** Change one item's quantity by hand. */
export class AdjustInventoryStockHandler extends ICQRSHandler<AdjustInventoryStockCommand, AdjustStockOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly stock: InventoryStockService,
    ) {
        super(logger)
    }

    protected override process(command: AdjustInventoryStockCommand): Promise<AdjustStockOutput> {
        return this.stock.adjustStock(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
