import type { InjectionToken } from "@nestjs/common"

/** What the full knowledge-sources capability needs from the composition root (the api and the cli). */
export interface KnowledgeSourcesFullOptions {
    /** The provider token of the storage door (a `StorageObjectsPort`) in the app. */
    readonly storage: InjectionToken
    /** Absent or false: the full capability. */
    readonly readOnly?: false
}

/**
 * The read-only mode (the mcp app): the reads that answer an agent's view (briefs, origins, public texts, the readable documents and
 * the dossier documents), with no storage door, no queue and nothing that writes.
 */
export interface KnowledgeSourcesReadOnlyOptions {
    /** Registers the read-only mode. */
    readonly readOnly: true
}

/** What the knowledge-sources capability needs from the composition root. */
export type KnowledgeSourcesOptions = KnowledgeSourcesFullOptions | KnowledgeSourcesReadOnlyOptions
