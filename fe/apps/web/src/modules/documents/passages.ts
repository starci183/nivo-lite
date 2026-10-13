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
}
