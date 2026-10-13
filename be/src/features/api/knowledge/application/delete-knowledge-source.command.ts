import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DeleteKnowledgeSourceRequest } from "./delete-knowledge-source.contracts"

/** Deletes a document, then takes back what it contributed to the brain. */
export class DeleteKnowledgeSourceCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DeleteKnowledgeSourceRequest>) {
        super()
    }
}
