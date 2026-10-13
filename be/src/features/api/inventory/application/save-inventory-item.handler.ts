import { CommandHandler } from "@nestjs/cqrs"
import { InventoryCatalogService } from "@modules/domain/inventory"
import type { SaveItemOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveInventoryItemCommand } from "./save-inventory-item.command"

@CommandHandler(SaveInventoryItemCommand)
/** Create or update one catalogue item. */
export class SaveInventoryItemHandler extends ICQRSHandler<SaveInventoryItemCommand, SaveItemOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly catalog: InventoryCatalogService,
    ) {
        super(logger)
    }

    protected override process(command: SaveInventoryItemCommand): Promise<SaveItemOutput> {
        return this.catalog.saveItem(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
