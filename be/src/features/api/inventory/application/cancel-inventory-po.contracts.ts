import type { CancelPoParams } from "@modules/domain/inventory"

/** What cancel a purchase order takes. */
export interface CancelInventoryPoRequest extends CancelPoParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
