import type { InjectionToken } from "@nestjs/common"

/** What the full knowledge-sources capability needs from the composition root (the api and the cli). */
export interface KnowledgeSourcesFullOptions {
    /** The provider token of the storage door (a `StorageObjectsPort`) in the app. */
    readonly storage: InjectionToken
    /** Absent or false: the full capability. */
    readonly readOnly?: false
    /** Absent or false: the full capability. */
    readonly seedOnly?: false
}

/**
 * The read-only mode (the mcp app): the reads that answer an agent's view (briefs, origins, public texts, and the readable documents),
 * with no storage door, no queue and nothing that writes.
 */
export interface KnowledgeSourcesReadOnlyOptions {
    /** Registers the read-only mode. */
    readonly readOnly: true
    /** The seed mode is another mode. */
    readonly seedOnly?: false
}

/**
 * The seed mode (the cli app): the one service that keeps the text documents of a stack seed as knowledge sources and queues their
 * indexing, with no storage door and none of the pages' services.
 */
export interface KnowledgeSourcesSeedOptions {
    /** Registers the seed mode. */
    readonly seedOnly: true
    /** The read-only mode is another mode. */
    readonly readOnly?: false
}

/** What the knowledge-sources capability needs from the composition root. */
export type KnowledgeSourcesOptions =
    KnowledgeSourcesFullOptions | KnowledgeSourcesReadOnlyOptions | KnowledgeSourcesSeedOptions
