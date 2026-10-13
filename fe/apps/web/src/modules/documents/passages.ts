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

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The passage a result item stands for, or nothing when it is not one. */
const passageOf = (item: unknown): ReadonlyArray<RetrievedPassage> => {
    if (!isRecord(item)) return []
    const { id, title, content, score, layer, visibility, topic } = item
    if (typeof id !== "string" || typeof title !== "string" || typeof content !== "string") return []
    return [
        {
            key: `${String(layer)}-${id}`,
            layer: layer === "nivo" ? "nivo" : "business",
            title,
            topic: typeof topic === "string" ? topic : null,
            content,
            score: typeof score === "number" ? score : 0,
            visibility: visibility === "public" ? "public" : "internal",
        },
    ]
}

/** The passages in the result of an ask command; anything that is not a passage is dropped. */
export const passagesOf = (result: unknown): ReadonlyArray<RetrievedPassage> => {
    const list = isRecord(result) ? result.passages : undefined
    return Array.isArray(list) ? list.flatMap(passageOf) : []
}
