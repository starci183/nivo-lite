import type { InjectionToken } from "@nestjs/common"

/** What the knowledge capability needs from the composition root. */
export interface KnowledgeOptions {
    /** The provider of the Google Drive access of a workspace (a `DriveAccessSource`); a connection capability provides it. */
    readonly driveAccess: InjectionToken
    /** Milliseconds to wait between two passages while a source is embedded; 0 in production. A demo pacing knob (`KNOWLEDGE_INDEX_CHUNK_DELAY_MS`) so progress can be watched live. */
    readonly indexChunkDelayMs: number
}

/** What the knowledge capability reads from the environment. */
export interface KnowledgeConfig {
    /** Milliseconds to wait between two passages while a source is embedded; see `KnowledgeOptions.indexChunkDelayMs`. */
    readonly indexChunkDelayMs: number
}
