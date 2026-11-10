/** What list agent catalog takes. */
export interface ListAgentCatalogRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
