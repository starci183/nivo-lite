/** What the DismissKnowledgeGap operation takes. */
export interface DismissKnowledgeGapRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The id. */
    readonly id: string
}
