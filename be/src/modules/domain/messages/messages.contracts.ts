import type { EntityManager } from "typeorm"

/** One line NIVO posts in the team chat of a workspace. */
export interface SystemMessage {
    /** The workspace whose chat receives the line. */
    readonly workspaceId: string
    /** The lead the line is about; null for a line about nothing in particular. */
    readonly leadId: string | null
    /** The text of the line. */
    readonly body: string
    /** The transaction of the caller, so the line is written exactly when the caller's change is. */
    readonly manager: EntityManager
}

/** One line of the Office thread as it was stored. */
export interface PostedMessage {
    /** The message id. */
    readonly id: string
    /** `human`, `agent` or `system`. */
    readonly author_kind: string
    /** The author's display name. */
    readonly author_name: string
    /** The agent that wrote it, when one did. */
    readonly agent_id: string | null
    /** The staff member it was written as, or null for the owner. */
    readonly staff_id: string | null
    /** The text. */
    readonly body: string
    /** The customer it is about. */
    readonly lead_id: string | null
    /** The work item it mirrors. */
    readonly work_item_id: string | null
    /** The Hub room it was posted in; null is the general Office room. */
    readonly room: string | null
    /** When it was written, ISO 8601. */
    readonly created_at: string
}
