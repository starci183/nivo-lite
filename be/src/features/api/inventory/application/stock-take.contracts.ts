import type { StockTakeParams } from "@modules/domain/inventory"

/** What the request to apply a stock count takes. */
export interface StockTakeRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: StockTakeParams
}
