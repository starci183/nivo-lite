/** What the SetKnowledgeSuggestionState operation takes. */
export interface SetKnowledgeSuggestionStateRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The key of the suggestion. */
    readonly key: string
    /** `dismissed` or `not_applicable`; absent brings the suggestion back. */
    readonly state?: "dismissed" | "not_applicable"
}
