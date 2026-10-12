import { Command } from "@nestjs/cqrs"
import type { SaveSupplierOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveSupplierRequest } from "./save-supplier.contracts"

/** Asks to create or update one supplier. */
export class SaveSupplierCommand extends Command<SaveSupplierOutput> {
    constructor(readonly params: ExecuteParams<SaveSupplierRequest>) {
        super()
    }
}
