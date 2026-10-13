import { CommandHandler } from "@nestjs/cqrs"
import { InventoryReceivingService } from "@modules/domain/inventory"
import type { ReceivePoOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReceiveInventoryPoCommand } from "./receive-inventory-po.command"

@CommandHandler(ReceiveInventoryPoCommand)
/** Receive goods against a purchase order. */
export class ReceiveInventoryPoHandler extends ICQRSHandler<ReceiveInventoryPoCommand, ReceivePoOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly receiving: InventoryReceivingService,
    ) {
        super(logger)
    }

    protected override process(command: ReceiveInventoryPoCommand): Promise<ReceivePoOutput> {
        return this.receiving.receivePo(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
