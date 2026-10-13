import type { SaveLocationParams } from "@modules/domain/inventory"

/** What create or rename one stock location takes. */
export interface SaveInventoryLocationRequest extends SaveLocationParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
