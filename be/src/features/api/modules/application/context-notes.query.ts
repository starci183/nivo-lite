import { Query } from "@nestjs/cqrs"
import type { ContextNote } from "@modules/domain/module-context-notes"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ContextNotesRequest } from "./context-notes.contracts"

/** Asks for the pending context notes of one installation. */
export class ContextNotesQuery extends Query<ReadonlyArray<ContextNote>> {
    constructor(readonly params: ExecuteParams<ContextNotesRequest>) {
        super()
    }
}
