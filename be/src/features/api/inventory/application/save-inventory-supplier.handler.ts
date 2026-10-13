import { CommandHandler } from "@nestjs/cqrs"
import { InventoryCatalogService } from "@modules/domain/inventory"
import type { SaveSupplierOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveInventorySupplierCommand } from "./save-inventory-supplier.command"

@CommandHandler(SaveInventorySupplierCommand)
/** Create or update one supplier. */
export class SaveInventorySupplierHandler extends ICQRSHandler<SaveInventorySupplierCommand, SaveSupplierOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly catalog: InventoryCatalogService,
    ) {
        super(logger)
    }

    protected override process(command: SaveInventorySupplierCommand): Promise<SaveSupplierOutput> {
        return this.catalog.saveSupplier(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
