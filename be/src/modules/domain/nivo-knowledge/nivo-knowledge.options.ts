/** What the nivo-knowledge capability needs from the composition root. */
export interface NivoKnowledgeOptions {
    /** The knowledge folders that are allowed: `core` and the folder of every module of the catalogue. */
    readonly folders: ReadonlyArray<string>
}
