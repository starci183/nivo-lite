import type { SaveItemParams } from "@modules/domain/inventory"

/** What the request to create or update one catalogue item takes. */
export interface SaveItemRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: SaveItemParams
}
