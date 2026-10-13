import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { AddKnowledgeRequest, AddKnowledgeResult } from "./add-knowledge.contracts"

/** Asks to add a text knowledge source to the workspace the API key acts for. */
export class AddKnowledgeCommand extends Command<AddKnowledgeResult> {
    constructor(readonly params: PublicExecuteParams<AddKnowledgeRequest>) {
        super()
    }
}
