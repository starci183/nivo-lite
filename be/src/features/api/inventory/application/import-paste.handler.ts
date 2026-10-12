import { CommandHandler } from "@nestjs/cqrs"
import { InventoryImportService } from "@modules/domain/inventory"
import type { ImportPasteOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ImportPasteCommand } from "./import-paste.command"

@CommandHandler(ImportPasteCommand)
/** Handles import items from a pasted table through one domain-service call. */
export class ImportPasteHandler extends ICQRSHandler<ImportPasteCommand, ImportPasteOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryImportService: InventoryImportService,
    ) {
        super(logger)
    }

    protected override process(command: ImportPasteCommand): Promise<ImportPasteOutput> {
        return this.inventoryImportService.importPasted(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
