import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveInventoryLocationRequest } from "./save-inventory-location.contracts"

/** Asks for create or rename one stock location. */
export class SaveInventoryLocationCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SaveInventoryLocationRequest>) {
        super()
    }
}
