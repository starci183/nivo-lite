/** The outcome of reading text as JSON: the value, or the cause when the text is not JSON. */
export interface JsonOutcome {
    /** The parsed value; undefined when the text was not JSON. */
    readonly value: unknown
    /** The parse failure; null when the text was JSON. */
    readonly cause: unknown
}

/** Reads text from a store or a channel as JSON; a failure comes back as an outcome that carries its cause. */
export const parseJson = (text: string): JsonOutcome => {
    try {
        return { value: JSON.parse(text), cause: null }
    } catch (cause) {
        return { value: undefined, cause }
    }
}
