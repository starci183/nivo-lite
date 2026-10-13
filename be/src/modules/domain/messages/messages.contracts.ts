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
