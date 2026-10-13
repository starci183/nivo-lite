import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdateSourceRequest } from "./update-source.contracts"

/** Asks to change the metadata of a document. */
export class UpdateSourceCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<UpdateSourceRequest>) {
        super()
    }
}
