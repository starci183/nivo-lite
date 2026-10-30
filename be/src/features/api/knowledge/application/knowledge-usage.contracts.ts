/** What the KnowledgeUsage operation takes. */
export interface KnowledgeUsageRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
