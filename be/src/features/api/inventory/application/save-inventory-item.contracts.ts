import type { SaveItemParams } from "@modules/domain/inventory"

/** What create or update one catalogue item takes. */
export interface SaveInventoryItemRequest extends SaveItemParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
