/** What the RetryKnowledgeSource operation takes. */
export interface RetryKnowledgeSourceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The id. */
    readonly id: string
}
