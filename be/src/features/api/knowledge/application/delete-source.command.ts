import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DeleteSourceRequest } from "./delete-source.contracts"

/** Asks to delete a document and take back what it contributed to the brain. */
export class DeleteSourceCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DeleteSourceRequest>) {
        super()
    }
}
