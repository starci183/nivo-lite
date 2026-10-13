/** What the whole inventory workbench of the caller's workspace takes. */
export interface InventoryWorkbenchRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
