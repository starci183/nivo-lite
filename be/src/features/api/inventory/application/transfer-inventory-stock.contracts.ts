import type { TransferStockParams } from "@modules/domain/inventory"

/** What move goods between two locations takes. */
export interface TransferInventoryStockRequest extends TransferStockParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
