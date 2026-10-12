import { CommandHandler } from "@nestjs/cqrs"
import { InventoryCatalogService } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetItemActiveCommand } from "./set-item-active.command"

@CommandHandler(SetItemActiveCommand)
/** Handles switch an item on or off through one domain-service call. */
export class SetItemActiveHandler extends ICQRSHandler<SetItemActiveCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryCatalogService: InventoryCatalogService,
    ) {
        super(logger)
    }

    protected override process(command: SetItemActiveCommand): Promise<void> {
        return this.inventoryCatalogService.setItemActive(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
