import { Command } from "@nestjs/cqrs"
import type { SaveItemOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveItemRequest } from "./save-item.contracts"

/** Asks to create or update one catalogue item. */
export class SaveItemCommand extends Command<SaveItemOutput> {
    constructor(readonly params: ExecuteParams<SaveItemRequest>) {
        super()
    }
}
