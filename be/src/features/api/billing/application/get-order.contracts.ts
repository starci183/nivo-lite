/** What reading one payment order takes. */
export interface GetOrderRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The order to read. */
    readonly orderId: string
}
