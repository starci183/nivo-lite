import type { InjectionToken } from "@nestjs/common"

/** What the knowledge capability needs from the composition root. */
export interface KnowledgeOptions {
    /** The provider of the Google Drive access of a workspace (a `DriveAccessSource`); a connection capability provides it. */
    readonly driveAccess: InjectionToken
}
