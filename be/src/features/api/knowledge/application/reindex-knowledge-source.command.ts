import { Command } from "@nestjs/cqrs"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReindexKnowledgeSourceRequest } from "./reindex-knowledge-source.contracts"

/** Reads a document again, optionally with new text. */
export class ReindexKnowledgeSourceCommand extends Command<SourceRef> {
    constructor(readonly params: ExecuteParams<ReindexKnowledgeSourceRequest>) {
        super()
    }
}
