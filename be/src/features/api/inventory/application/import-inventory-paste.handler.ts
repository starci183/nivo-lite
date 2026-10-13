import { CommandHandler } from "@nestjs/cqrs"
import { InventoryImportService } from "@modules/domain/inventory"
import type { ImportPasteOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ImportInventoryPasteCommand } from "./import-inventory-paste.command"

@CommandHandler(ImportInventoryPasteCommand)
/** Import catalogue items from a pasted table. */
export class ImportInventoryPasteHandler extends ICQRSHandler<ImportInventoryPasteCommand, ImportPasteOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly imports: InventoryImportService,
    ) {
        super(logger)
    }

    protected override process(command: ImportInventoryPasteCommand): Promise<ImportPasteOutput> {
        return this.imports.importPasted(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
