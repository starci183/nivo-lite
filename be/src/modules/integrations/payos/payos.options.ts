/** Options of the payOS integration. */
export interface PayosOptions {
    /** The base of the API, without a trailing slash. */
    readonly apiBase: string
    /** How long one call waits for the answer. */
    readonly timeoutMs: number
}
