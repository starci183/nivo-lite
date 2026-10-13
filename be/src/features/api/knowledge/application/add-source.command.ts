import { Command } from "@nestjs/cqrs"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AddSourceRequest } from "./add-source.contracts"

/** Asks to add a document to the knowledge of the caller's workspace. */
export class AddSourceCommand extends Command<SourceRef> {
    constructor(readonly params: ExecuteParams<AddSourceRequest>) {
        super()
    }
}
