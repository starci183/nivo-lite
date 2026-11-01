import type { SourceStatus } from "./knowledge-sources.contracts"

/** The stages a source passes while it is taken in, in order; the table holds them under a CHECK. The last, `critic`, is worn by a ready document while the critic checks its dossier. */
export type SourceStage = "read" | "chunk" | "embed" | "store" | "facts" | "critic"

/** Where one source stands while a worker is on it: the state the Knowledge page shows, read from the row. */
export interface SourceProgress {
    /** The source. */
    readonly sourceId: string
    /** Where the source stands. */
    readonly status: string
    /** 0 to 100. */
    readonly progress: number
    /** The stage the worker is on, or null when no worker is on it. */
    readonly stage: SourceStage | null
    /** How many passages of the stage are done (the embed stage: passages with their vector), or null. */
    readonly done: number | null
    /** How many passages the stage has in all, or null. */
    readonly total: number | null
    /** The stored code or note of the source, or null. */
    readonly error: string | null
    /** How many passages are stored. */
    readonly chunkCount: number
    /** ISO 8601 time of the state; a client keeps the newest state of a source. */
    readonly at: string
}

/** One change of a source, pushed after it was stored: the whole state of the source it concerns. */
export interface KnowledgeProgressFrame extends SourceProgress {
    /** The domain event id of the frame: `progress:<uuid>`, the `Last-Event-ID` resume point. */
    readonly id: string
    /** Marks the frame as one source's change. */
    readonly kind: "progress"
}

/** What a writer changes about a source: only the columns it names are written. */
export interface ProgressChange {
    /** The new status. */
    readonly status?: SourceStatus
    /** The new progress, 0 to 100 (rounded and clamped). */
    readonly progress?: number
    /** The stage, or null to clear it. */
    readonly stage?: SourceStage | null
    /** Passages done in the stage, or null to clear. */
    readonly done?: number | null
    /** Passages of the stage in all, or null to clear. */
    readonly total?: number | null
    /** The stored code or note, or null to clear it. */
    readonly error?: string | null
    /** How many passages are stored. */
    readonly chunkCount?: number
    /** The hash of the text now complete. */
    readonly contentHash?: string
}
