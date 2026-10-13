import type { DriveAccessSource } from "./knowledge.contracts"

/** What the knowledge capability needs from the composition root. */
export interface KnowledgeOptions {
    /** Where the Google Drive access of a workspace comes from; a connection capability provides it, none yet gives nothing. */
    readonly driveAccess: DriveAccessSource
}
