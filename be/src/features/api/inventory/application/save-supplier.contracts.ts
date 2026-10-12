import type { SaveSupplierParams } from "@modules/domain/inventory"

/** What the request to create or update one supplier takes. */
export interface SaveSupplierRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: SaveSupplierParams
}
