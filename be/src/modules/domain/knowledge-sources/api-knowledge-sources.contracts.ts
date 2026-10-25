/** A public-API text source admitted with its durable request identity. */
export interface ApiTextSourceInput {
    /** The workspace authorized by the API key. */
    readonly workspaceId: string
    /** The request id, which is also the source id promised by the public API. */
    readonly sourceId: string
    /** The source title. */
    readonly title: string
    /** The text to index. */
    readonly content: string
    /** The topic, or null for none. */
    readonly topic: string | null
    /** The tags retained by admission. */
    readonly tags: ReadonlyArray<string>
    /** The audience permitted to read the source. */
    readonly visibility: "public" | "internal"
    /** The API key's audit identity. */
    readonly origin: string
}
