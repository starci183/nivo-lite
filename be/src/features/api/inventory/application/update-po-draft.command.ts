import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdatePoDraftRequest } from "./update-po-draft.contracts"

/** Asks to edit a draft purchase order. */
export class UpdatePoDraftCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<UpdatePoDraftRequest>) {
        super()
    }
}
