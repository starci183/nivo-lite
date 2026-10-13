import { Command } from "@nestjs/cqrs"
import type { SaveSupplierOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveInventorySupplierRequest } from "./save-inventory-supplier.contracts"

/** Asks for create or update one supplier. */
export class SaveInventorySupplierCommand extends Command<SaveSupplierOutput> {
    constructor(readonly params: ExecuteParams<SaveInventorySupplierRequest>) {
        super()
    }
}
