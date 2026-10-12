import type { CreatePoParams } from "@modules/domain/inventory"

/** What the request to create a purchase order takes. */
export interface CreatePoRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: CreatePoParams
}
