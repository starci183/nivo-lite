import { Command } from "@nestjs/cqrs"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReindexSourceRequest } from "./reindex-source.contracts"

/** Asks to read a document again, optionally with new text. */
export class ReindexSourceCommand extends Command<SourceRef> {
    constructor(readonly params: ExecuteParams<ReindexSourceRequest>) {
        super()
    }
}
