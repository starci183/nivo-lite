import type { ReceivePoParams } from "@modules/domain/inventory"

/** What the request to receive goods against a purchase order takes. */
export interface ReceivePoRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: ReceivePoParams
}
