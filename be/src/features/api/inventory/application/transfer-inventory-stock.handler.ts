import { CommandHandler } from "@nestjs/cqrs"
import { InventoryStockService } from "@modules/domain/inventory"
import type { TransferStockOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TransferInventoryStockCommand } from "./transfer-inventory-stock.command"

@CommandHandler(TransferInventoryStockCommand)
/** Move goods between two locations. */
export class TransferInventoryStockHandler extends ICQRSHandler<TransferInventoryStockCommand, TransferStockOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly stock: InventoryStockService,
    ) {
        super(logger)
    }

    protected override process(command: TransferInventoryStockCommand): Promise<TransferStockOutput> {
        return this.stock.transferStock(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
