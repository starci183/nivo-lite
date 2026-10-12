import { CommandHandler } from "@nestjs/cqrs"
import { InventoryCatalogService } from "@modules/domain/inventory"
import type { SaveSupplierOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveSupplierCommand } from "./save-supplier.command"

@CommandHandler(SaveSupplierCommand)
/** Handles create or update one supplier through one domain-service call. */
export class SaveSupplierHandler extends ICQRSHandler<SaveSupplierCommand, SaveSupplierOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryCatalogService: InventoryCatalogService,
    ) {
        super(logger)
    }

    protected override process(command: SaveSupplierCommand): Promise<SaveSupplierOutput> {
        return this.inventoryCatalogService.saveSupplier(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
