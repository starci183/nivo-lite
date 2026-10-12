import type { SetItemActiveParams } from "@modules/domain/inventory"

/** What the request to switch an item on or off takes. */
export interface SetItemActiveRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: SetItemActiveParams
}
