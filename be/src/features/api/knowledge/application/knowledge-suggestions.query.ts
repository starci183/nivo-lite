import { Query } from "@nestjs/cqrs"
import type { SuggestionContext } from "@modules/domain/knowledge-suggestion-state"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { KnowledgeSuggestionsRequest } from "./knowledge-suggestions.contracts"

/** Reads what the workspace decided about its knowledge suggestions and its business type. */
export class KnowledgeSuggestionsQuery extends Query<SuggestionContext> {
    constructor(readonly params: ExecuteParams<KnowledgeSuggestionsRequest>) {
        super()
    }
}
