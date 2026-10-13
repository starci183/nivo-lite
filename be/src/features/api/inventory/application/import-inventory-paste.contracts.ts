import type { ImportPasteParams } from "@modules/domain/inventory"

/** What import catalogue items from a pasted table takes. */
export interface ImportInventoryPasteRequest extends ImportPasteParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
