import { CommandHandler } from "@nestjs/cqrs"
import { InventoryOrdersService } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CancelPoCommand } from "./cancel-po.command"

@CommandHandler(CancelPoCommand)
/** Handles cancel a purchase order through one domain-service call. */
export class CancelPoHandler extends ICQRSHandler<CancelPoCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryOrdersService: InventoryOrdersService,
    ) {
        super(logger)
    }

    protected override process(command: CancelPoCommand): Promise<void> {
        return this.inventoryOrdersService.cancelPo(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
