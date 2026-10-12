import { CommandHandler } from "@nestjs/cqrs"
import { InventoryLocationsService } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveLocationCommand } from "./save-location.command"

@CommandHandler(SaveLocationCommand)
/** Handles create or rename one stock location through one domain-service call. */
export class SaveLocationHandler extends ICQRSHandler<SaveLocationCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryLocationsService: InventoryLocationsService,
    ) {
        super(logger)
    }

    protected override process(command: SaveLocationCommand): Promise<void> {
        return this.inventoryLocationsService.saveLocation(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
