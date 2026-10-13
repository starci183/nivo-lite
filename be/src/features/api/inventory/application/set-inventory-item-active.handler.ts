import { CommandHandler } from "@nestjs/cqrs"
import { InventoryCatalogService } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetInventoryItemActiveCommand } from "./set-inventory-item-active.command"

@CommandHandler(SetInventoryItemActiveCommand)
/** Switch a catalogue item on or off. */
export class SetInventoryItemActiveHandler extends ICQRSHandler<SetInventoryItemActiveCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly catalog: InventoryCatalogService,
    ) {
        super(logger)
    }

    protected override process(command: SetInventoryItemActiveCommand): Promise<void> {
        return this.catalog.setItemActive(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
