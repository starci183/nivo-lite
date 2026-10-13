import type { KnowledgeSuggestionsRequest } from "../../application/knowledge-suggestions.contracts"
import type { SuggestionContext } from "@modules/domain/knowledge-suggestion-state"
import type { KnowledgeSuggestionContextType } from "./dto/knowledge-suggestion-context.type"

/** Maps the workspace of the call to the request. */
export const toKnowledgeSuggestionsRequest = (workspaceId: string): KnowledgeSuggestionsRequest => ({ workspaceId })

/** Maps the answer to the GraphQL type. */
export const toKnowledgeSuggestionsType = (result: SuggestionContext): KnowledgeSuggestionContextType => ({
    decisions: result.decisions.map((decision) => ({ ...decision })),
    businessType: result.businessType,
})
