import type { InjectionToken } from "@nestjs/common"

/** What the full knowledge capability needs from the composition root (the api and the cli). */
export interface KnowledgeFullOptions {
    /** The provider of the Google Drive access of a workspace (a `DriveAccessSource`); a connection capability provides it. */
    readonly driveAccess: InjectionToken
    /** Absent or false: the full capability. */
    readonly searchOnly?: false
}

/**
 * The search-only mode (the mcp app): the metered embedding of a question and the search over both layers, with no indexing, no
 * jobs and no Drive access.
 */
export interface KnowledgeSearchOnlyOptions {
    /** Registers the search-only mode. */
    readonly searchOnly: true
}

/** What the knowledge capability needs from the composition root. */
export type KnowledgeOptions = KnowledgeFullOptions | KnowledgeSearchOnlyOptions
