/** What a structured call answered, with the model and the tokens of every call it took. */
export interface ModelCallResult<T> {
    /** The parsed answer. */
    readonly value: T
    /** The model of the answer that was read. */
    readonly model: string
    /** Prompt tokens of all calls, or null when none reported any. */
    readonly promptTokens: number | null
    /** Completion tokens of all calls, or null when none reported any. */
    readonly completionTokens: number | null
}
