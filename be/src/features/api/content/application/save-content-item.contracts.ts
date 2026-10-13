import type { SaveContentItem } from "@modules/domain/content-items"

/** Workspace-scoped saveContentItem request. */
export interface SaveContentItemRequest {
    /** The workspace whose membership and manager role the service verifies. */
    readonly workspaceId: string
    /** The post whose editable fields change. */
    readonly id: string
    /** The whitelisted fields to update; omitted fields remain unchanged. */
    readonly input: SaveContentItem
}
