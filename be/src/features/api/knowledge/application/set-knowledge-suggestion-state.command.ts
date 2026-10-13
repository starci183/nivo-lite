import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetKnowledgeSuggestionStateRequest } from "./set-knowledge-suggestion-state.contracts"

/** Marks a knowledge suggestion dismissed or not applicable, or brings it back. */
export class SetKnowledgeSuggestionStateCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetKnowledgeSuggestionStateRequest>) {
        super()
    }
}
