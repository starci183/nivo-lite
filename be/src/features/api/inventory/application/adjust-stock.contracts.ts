import type { AdjustStockParams } from "@modules/domain/inventory"

/** What the request to change one item's quantity by hand takes. */
export interface AdjustStockRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: AdjustStockParams
}
