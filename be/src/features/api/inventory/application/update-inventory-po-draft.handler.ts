import { CommandHandler } from "@nestjs/cqrs"
import { InventoryOrdersService } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpdateInventoryPoDraftCommand } from "./update-inventory-po-draft.command"

@CommandHandler(UpdateInventoryPoDraftCommand)
/** Edit a draft purchase order. */
export class UpdateInventoryPoDraftHandler extends ICQRSHandler<UpdateInventoryPoDraftCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly orders: InventoryOrdersService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateInventoryPoDraftCommand): Promise<void> {
        return this.orders.updatePoDraft(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
