import type { SetKnowledgeSuggestionStateRequest } from "../../application/set-knowledge-suggestion-state.contracts"
import type { SetKnowledgeSuggestionStateInput } from "./dto/set-knowledge-suggestion-state.input"

/** Maps the GraphQL input to the request. */
export const toSetKnowledgeSuggestionStateRequest = (workspaceId: string, input: SetKnowledgeSuggestionStateInput): SetKnowledgeSuggestionStateRequest => ({
    workspaceId,
    key: input.key,
    state: input.state,
})
