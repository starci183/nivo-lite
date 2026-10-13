import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReembedKnowledgeRequest } from "./reembed-knowledge.contracts"

/** Queues the re-embedding of the passages of the workspace made by another model. */
export class ReembedKnowledgeCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<ReembedKnowledgeRequest>) {
        super()
    }
}
