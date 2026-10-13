import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DismissKnowledgeGapRequest } from "./dismiss-knowledge-gap.contracts"

/** Marks a customer question as not needing an answer. */
export class DismissKnowledgeGapCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DismissKnowledgeGapRequest>) {
        super()
    }
}
