import type { StockTakeParams } from "@modules/domain/inventory"

/** What apply a stock count takes. */
export interface TakeInventoryStockRequest extends StockTakeParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
