/** What the KnowledgeCategories operation takes. */
export interface KnowledgeCategoriesRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
