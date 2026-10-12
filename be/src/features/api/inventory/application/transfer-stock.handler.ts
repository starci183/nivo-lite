import { CommandHandler } from "@nestjs/cqrs"
import { InventoryStockService } from "@modules/domain/inventory"
import type { TransferStockOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TransferStockCommand } from "./transfer-stock.command"

@CommandHandler(TransferStockCommand)
/** Handles move goods between two locations through one domain-service call. */
export class TransferStockHandler extends ICQRSHandler<TransferStockCommand, TransferStockOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryStockService: InventoryStockService,
    ) {
        super(logger)
    }

    protected override process(command: TransferStockCommand): Promise<TransferStockOutput> {
        return this.inventoryStockService.transferStock(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
