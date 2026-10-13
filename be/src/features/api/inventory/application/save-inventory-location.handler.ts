import { CommandHandler } from "@nestjs/cqrs"
import { InventoryLocationsService } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveInventoryLocationCommand } from "./save-inventory-location.command"

@CommandHandler(SaveInventoryLocationCommand)
/** Create or rename one stock location. */
export class SaveInventoryLocationHandler extends ICQRSHandler<SaveInventoryLocationCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly locations: InventoryLocationsService,
    ) {
        super(logger)
    }

    protected override process(command: SaveInventoryLocationCommand): Promise<void> {
        return this.locations.saveLocation(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
