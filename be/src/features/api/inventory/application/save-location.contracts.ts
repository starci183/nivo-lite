import type { SaveLocationParams } from "@modules/domain/inventory"

/** What the request to create or rename one stock location takes. */
export interface SaveLocationRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: SaveLocationParams
}
