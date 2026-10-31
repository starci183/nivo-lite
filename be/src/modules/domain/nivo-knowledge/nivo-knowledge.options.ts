/** What the full nivo-knowledge capability needs from the composition root (the api and the cli). */
export interface NivoKnowledgeFullOptions {
    /** The knowledge folders that are allowed: `core` and the folder of every module of the catalogue. */
    readonly folders: ReadonlyArray<string>
    /** Absent or false: the full capability. */
    readonly searchOnly?: false
}

/** The search-only mode (the mcp app): the search of the base knowledge, with no folder client, no seeding and no publishing. */
export interface NivoKnowledgeSearchOnlyOptions {
    /** No folder is read or written in this mode. */
    readonly folders: readonly []
    /** Registers the search-only mode. */
    readonly searchOnly: true
}

/** What the nivo-knowledge capability needs from the composition root. */
export type NivoKnowledgeOptions = NivoKnowledgeFullOptions | NivoKnowledgeSearchOnlyOptions
