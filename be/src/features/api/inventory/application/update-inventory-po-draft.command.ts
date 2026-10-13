import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdateInventoryPoDraftRequest } from "./update-inventory-po-draft.contracts"

/** Asks for edit a draft purchase order. */
export class UpdateInventoryPoDraftCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<UpdateInventoryPoDraftRequest>) {
        super()
    }
}
