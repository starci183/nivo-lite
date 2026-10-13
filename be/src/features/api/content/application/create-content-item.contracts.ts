import type { CreateContentItem } from "@modules/domain/content-items"

/** Workspace-scoped createContentItem request. */
export interface CreateContentItemRequest {
    /** The workspace whose membership and manager role the service verifies. */
    readonly workspaceId: string
    /** The proposed title, destinations, theme and schedule of the new idea. */
    readonly input: CreateContentItem
}
