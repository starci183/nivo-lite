/** What the KnowledgeSource operation takes. */
export interface KnowledgeSourceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The id. */
    readonly id: string
}
