/** The audience a module's agent speaks to. */
export interface ModuleAudienceRow {
    /** customer or internal. */
    readonly audience: string
}

/** One passage the hybrid search found. */
export interface PassageRow {
    /** nivo or business. */
    readonly layer: string
    /** The passage id. */
    readonly id: string
    /** The source, or null for the base knowledge. */
    readonly source_id: string | null
    /** The module. */
    readonly module: string | null
    /** The kind of the source or item. */
    readonly kind: string
    /** The title. */
    readonly title: string
    /** The text. */
    readonly content: string
    /** The relevance. */
    readonly score: number
    /** public or internal. */
    readonly visibility: string
    /** The topic. */
    readonly topic: string | null
}
