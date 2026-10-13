/** What counting the base knowledge of a module takes. */
export interface NivoKnowledgeCountRequest {
    /** The module folder. The shared `core` folder is always counted with it. */
    readonly module: string
}
