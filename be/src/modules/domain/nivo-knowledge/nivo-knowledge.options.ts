/** What the full nivo-knowledge capability needs from the composition root (the api). */
export interface NivoKnowledgeFullOptions {
    /** The knowledge folders that are allowed: `core` and the folder of every module of the catalogue. */
    readonly folders: ReadonlyArray<string>
    /** Absent or false: not the search-only mode. */
    readonly searchOnly?: false
    /** Absent or false: not the publish-only mode. */
    readonly publishOnly?: false
}

/** The search-only mode (the mcp app): the search of the base knowledge, with no folder client, no seeding and no publishing. */
export interface NivoKnowledgeSearchOnlyOptions {
    /** No folder is read or written in this mode. */
    readonly folders: readonly []
    /** Registers the search-only mode. */
    readonly searchOnly: true
}

/**
 * The publish-only mode (the cli): the folder client, the publishing and the seed, with no search and no vector index (the items'
 * sync jobs are written with the publish; the api's worker brings the index in step).
 */
export interface NivoKnowledgePublishOnlyOptions {
    /** The knowledge folders that are allowed: `core` and the folder of every module of the catalogue. */
    readonly folders: ReadonlyArray<string>
    /** Registers the publish-only mode. */
    readonly publishOnly: true
}

/** What the nivo-knowledge capability needs from the composition root. */
export type NivoKnowledgeOptions = NivoKnowledgeFullOptions | NivoKnowledgeSearchOnlyOptions | NivoKnowledgePublishOnlyOptions
