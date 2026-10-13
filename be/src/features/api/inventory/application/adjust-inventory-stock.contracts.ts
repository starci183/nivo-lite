import type { AdjustStockParams } from "@modules/domain/inventory"

/** What change one item's quantity by hand takes. */
export interface AdjustInventoryStockRequest extends AdjustStockParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
