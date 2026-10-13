/** One row of public.knowledge_suggestion_state. */
export interface SuggestionStateRow {
    /** The key of the suggestion. */
    readonly suggestion_key: string
    /** dismissed or not_applicable. */
    readonly state: string
}

/** The business type of a workspace. */
export interface BusinessTypeRow {
    /** The business type, or null. */
    readonly business_type: string | null
}
