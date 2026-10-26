/** One passage an agent would retrieve, labelled by layer. */
export interface RetrievedPassage {
    readonly key: string
    /** nivo = the base knowledge of NIVO, business = the documents of the owner. */
    readonly layer: "nivo" | "business"
    readonly title: string
    readonly topic: string | null
    readonly content: string
    readonly score: number
    readonly visibility: "public" | "internal"
    /** The document a business passage was read from, for the link to it; null for the base knowledge. */
    readonly sourceId: string | null
    /** The place of the passage in its document, counted from 1; null for the base knowledge. */
    readonly position: number | null
}
