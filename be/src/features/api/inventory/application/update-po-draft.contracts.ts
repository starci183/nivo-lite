import type { UpdatePoDraftParams } from "@modules/domain/inventory"

/** What the request to edit a draft purchase order takes. */
export interface UpdatePoDraftRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: UpdatePoDraftParams
}
