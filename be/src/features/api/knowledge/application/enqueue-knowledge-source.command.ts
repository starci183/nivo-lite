import { Command } from "@nestjs/cqrs"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { EnqueueKnowledgeSourceRequest } from "./enqueue-knowledge-source.contracts"

/** Adds a document and queues its indexing. */
export class EnqueueKnowledgeSourceCommand extends Command<SourceRef> {
    constructor(readonly params: ExecuteParams<EnqueueKnowledgeSourceRequest>) {
        super()
    }
}
