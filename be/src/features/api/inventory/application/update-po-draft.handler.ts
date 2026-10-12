import { CommandHandler } from "@nestjs/cqrs"
import { InventoryOrdersService } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpdatePoDraftCommand } from "./update-po-draft.command"

@CommandHandler(UpdatePoDraftCommand)
/** Handles edit a draft purchase order through one domain-service call. */
export class UpdatePoDraftHandler extends ICQRSHandler<UpdatePoDraftCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryOrdersService: InventoryOrdersService,
    ) {
        super(logger)
    }

    protected override process(command: UpdatePoDraftCommand): Promise<void> {
        return this.inventoryOrdersService.updatePoDraft(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
