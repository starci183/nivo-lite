/** What the request to draft purchase orders for low items takes. */
export interface DraftLowStockRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
