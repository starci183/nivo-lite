import { Command } from "@nestjs/cqrs"
import type { SaveItemOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveInventoryItemRequest } from "./save-inventory-item.contracts"

/** Asks for create or update one catalogue item. */
export class SaveInventoryItemCommand extends Command<SaveItemOutput> {
    constructor(readonly params: ExecuteParams<SaveInventoryItemRequest>) {
        super()
    }
}
