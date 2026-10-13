import type { SaveSupplierParams } from "@modules/domain/inventory"

/** What create or update one supplier takes. */
export interface SaveInventorySupplierRequest extends SaveSupplierParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
