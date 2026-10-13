import type { ReceivePoParams } from "@modules/domain/inventory"

/** What receive goods against a purchase order takes. */
export interface ReceiveInventoryPoRequest extends ReceivePoParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
