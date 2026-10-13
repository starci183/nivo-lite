/** What the DeleteKnowledgeSource operation takes. */
export interface DeleteKnowledgeSourceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The id. */
    readonly id: string
}
