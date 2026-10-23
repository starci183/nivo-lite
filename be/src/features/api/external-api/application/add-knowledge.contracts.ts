/** What adding a knowledge source takes, as the caller sent it. */
export interface AddKnowledgeRequest {
    /** The Authorization header as sent. */
    readonly authorization: string | undefined
    /** The source title. */
    readonly title: string
    /** The text of the source. */
    readonly content: string
    /** The topic. */
    readonly topic?: string | undefined
    /** `public` lets customers be answered from it; anything else keeps it internal. */
    readonly visibility?: string | undefined
    /** The tags. */
    readonly tags?: ReadonlyArray<string> | undefined
}

/** What adding a knowledge source answers: the source is queued for indexing. */
export interface AddKnowledgeResult {
    /** The source id. */
    readonly id: string
    /** The source is queued for indexing. */
    readonly status: "queued"
}
