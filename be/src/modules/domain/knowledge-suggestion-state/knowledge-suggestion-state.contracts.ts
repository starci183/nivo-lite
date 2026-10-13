/** What a workspace decided about a knowledge suggestion. */
export type SuggestionState = "dismissed" | "not_applicable"

/** One suggestion a workspace decided about. */
export interface SuggestionDecision {
    /** The key of the suggestion. */
    readonly key: string
    /** What was decided. */
    readonly state: SuggestionState
}

/** What the workspace decided about its knowledge suggestions, and its business type (which suggestions fit). */
export interface SuggestionContext {
    /** The decisions. */
    readonly decisions: ReadonlyArray<SuggestionDecision>
    /** The business type chosen at onboarding, or null. */
    readonly businessType: string | null
}
