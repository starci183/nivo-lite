/** What draft purchase orders for the items at or below their reorder point takes. */
export interface DraftInventoryLowStockRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
