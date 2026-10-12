import { Command } from "@nestjs/cqrs"
import type { ImportPasteOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ImportPasteRequest } from "./import-paste.contracts"

/** Asks to import items from a pasted table. */
export class ImportPasteCommand extends Command<ImportPasteOutput> {
    constructor(readonly params: ExecuteParams<ImportPasteRequest>) {
        super()
    }
}
