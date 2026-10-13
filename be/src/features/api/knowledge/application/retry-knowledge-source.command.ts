import { Command } from "@nestjs/cqrs"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RetryKnowledgeSourceRequest } from "./retry-knowledge-source.contracts"

/** Puts a failed or credit-blocked document back on the queue. */
export class RetryKnowledgeSourceCommand extends Command<SourceRef> {
    constructor(readonly params: ExecuteParams<RetryKnowledgeSourceRequest>) {
        super()
    }
}
