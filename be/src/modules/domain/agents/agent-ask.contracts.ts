/** A question tried as an agent: which agent and audience it is asked as. */
export interface AskAsAgentInput {
    /** The question. */
    readonly question: string
    /** The agent module the question is asked as. */
    readonly module: string
    /** `customer` reads the public view only; `internal` the team's. */
    readonly audience: string
    /** The agent instance, or absent for the shared knowledge only. */
    readonly installationId?: string | null | undefined
}

/** One result of a question tried as an agent: a passage of a document or of the base knowledge, or a confirmed fact (layer `fact`). */
export interface AskedPassage {
    /** `nivo`, `business` or `fact`. */
    readonly layer: string
    /** The passage or fact id. */
    readonly id: string
    /** The document, for a business passage. */
    readonly sourceId: string | null
    /** The module. */
    readonly module: string | null
    /** The kind of the document or item. */
    readonly kind: string
    /** The title. */
    readonly title: string
    /** The text. */
    readonly content: string
    /** The relevance, higher first. */
    readonly score: number
    /** `public` or `internal` for a passage; the scope of a fact. */
    readonly visibility: string
    /** The topic. */
    readonly topic: string | null
    /** The order of the passage inside its document, or null. */
    readonly order?: number | null
}
