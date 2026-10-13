import { CommandHandler } from "@nestjs/cqrs"
import { InventoryOrdersService } from "@modules/domain/inventory"
import type { CreatePoOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateInventoryPoCommand } from "./create-inventory-po.command"

@CommandHandler(CreateInventoryPoCommand)
/** Create a draft purchase order. */
export class CreateInventoryPoHandler extends ICQRSHandler<CreateInventoryPoCommand, CreatePoOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly orders: InventoryOrdersService,
    ) {
        super(logger)
    }

    protected override process(command: CreateInventoryPoCommand): Promise<CreatePoOutput> {
        return this.orders.createPo(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
