import type { ImportPasteParams } from "@modules/domain/inventory"

/** What the request to import items from a pasted table takes. */
export interface ImportPasteRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: ImportPasteParams
}
