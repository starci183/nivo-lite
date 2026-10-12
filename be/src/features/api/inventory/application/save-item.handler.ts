import { CommandHandler } from "@nestjs/cqrs"
import { InventoryCatalogService } from "@modules/domain/inventory"
import type { SaveItemOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveItemCommand } from "./save-item.command"

@CommandHandler(SaveItemCommand)
/** Handles create or update one catalogue item through one domain-service call. */
export class SaveItemHandler extends ICQRSHandler<SaveItemCommand, SaveItemOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryCatalogService: InventoryCatalogService,
    ) {
        super(logger)
    }

    protected override process(command: SaveItemCommand): Promise<SaveItemOutput> {
        return this.inventoryCatalogService.saveItem(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
