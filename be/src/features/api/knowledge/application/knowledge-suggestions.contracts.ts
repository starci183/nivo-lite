/** What the KnowledgeSuggestions operation takes. */
export interface KnowledgeSuggestionsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
