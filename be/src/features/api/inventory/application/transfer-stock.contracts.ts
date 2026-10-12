import type { TransferStockParams } from "@modules/domain/inventory"

/** What the request to move goods between two locations takes. */
export interface TransferStockRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: TransferStockParams
}
