import type { RequestSendParams } from "@modules/domain/inventory"

/** What put a purchase order before the owner to send, or to remind the supplier takes. */
export interface RequestInventorySendRequest extends RequestSendParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
