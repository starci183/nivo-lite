/** Options of the SePay integration. */
export interface SepayOptions {
    /** The origin of the SePay user API, without a trailing slash. */
    readonly apiBase: string
    /** How long one user-API call waits for the answer. */
    readonly timeoutMs: number
}
