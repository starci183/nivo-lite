import { CommandHandler } from "@nestjs/cqrs"
import { InventoryReceivingService } from "@modules/domain/inventory"
import type { ReceivePoOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReceivePoCommand } from "./receive-po.command"

@CommandHandler(ReceivePoCommand)
/** Handles receive goods against a purchase order through one domain-service call. */
export class ReceivePoHandler extends ICQRSHandler<ReceivePoCommand, ReceivePoOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryReceivingService: InventoryReceivingService,
    ) {
        super(logger)
    }

    protected override process(command: ReceivePoCommand): Promise<ReceivePoOutput> {
        return this.inventoryReceivingService.receivePo(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
