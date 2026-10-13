import type { CreatePoParams } from "@modules/domain/inventory"

/** What create a draft purchase order takes. */
export interface CreateInventoryPoRequest extends CreatePoParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
