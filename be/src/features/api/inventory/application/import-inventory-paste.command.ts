import { Command } from "@nestjs/cqrs"
import type { ImportPasteOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ImportInventoryPasteRequest } from "./import-inventory-paste.contracts"

/** Asks for import catalogue items from a pasted table. */
export class ImportInventoryPasteCommand extends Command<ImportPasteOutput> {
    constructor(readonly params: ExecuteParams<ImportInventoryPasteRequest>) {
        super()
    }
}
