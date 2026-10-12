import type { DeductOrderParams } from "@modules/domain/inventory"

/** What the request to take a confirmed order out of stock takes. */
export interface DeductOrderRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: DeductOrderParams
}
