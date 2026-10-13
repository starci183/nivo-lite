/** What the starter sets a new shop can pick takes. */
export interface InventoryTemplatesRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
