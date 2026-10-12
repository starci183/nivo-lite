import type { RequestSendParams } from "@modules/domain/inventory"

/** What the request to put a purchase order before the owner to send takes. */
export interface RequestSendRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: RequestSendParams
}
