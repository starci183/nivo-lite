import { CommandHandler } from "@nestjs/cqrs"
import { InventoryOrdersService } from "@modules/domain/inventory"
import type { CreatePoOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreatePoCommand } from "./create-po.command"

@CommandHandler(CreatePoCommand)
/** Handles create a purchase order through one domain-service call. */
export class CreatePoHandler extends ICQRSHandler<CreatePoCommand, CreatePoOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryOrdersService: InventoryOrdersService,
    ) {
        super(logger)
    }

    protected override process(command: CreatePoCommand): Promise<CreatePoOutput> {
        return this.inventoryOrdersService.createPo(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
