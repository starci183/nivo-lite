/** One retrieved passage, labelled by layer. */
export class PassageResponse {
    /** nivo or business. */
    layer!: string
    /** The passage id. */
    id!: string
    /** The document, for a business passage. */
    sourceId!: string | null
    /** The module. */
    module!: string | null
    /** The kind of the document or item. */
    kind!: string
    /** The title. */
    title!: string
    /** The text. */
    content!: string
    /** The relevance, higher first. */
    score!: number
    /** public or internal. */
    visibility!: string
    /** The topic. */
    topic!: string | null
}
