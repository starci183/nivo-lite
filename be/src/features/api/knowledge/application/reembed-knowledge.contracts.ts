/** What the ReembedKnowledge operation takes. */
export interface ReembedKnowledgeRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
