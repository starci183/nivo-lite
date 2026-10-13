import type { UpdatePoDraftParams } from "@modules/domain/inventory"

/** What edit a draft purchase order takes. */
export interface UpdateInventoryPoDraftRequest extends UpdatePoDraftParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
