import type { CancelPoParams } from "@modules/domain/inventory"

/** What the request to cancel a purchase order takes. */
export interface CancelPoRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: CancelPoParams
}
