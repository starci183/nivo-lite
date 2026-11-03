import { KnowledgeSuggestionStateEntity } from "./knowledge-suggestion-state.entity"

export { KnowledgeSuggestionStateEntity }

/** The entities the knowledge-suggestion-state capability owns, collected by the database module. */
export const knowledgeSuggestionStateEntities: readonly [typeof KnowledgeSuggestionStateEntity] = [
    KnowledgeSuggestionStateEntity,
] as const
