/** Options of the Shotstack integration: tunables only (the API key and the environment are per connection). */
export interface ShotstackOptions {
    /** The Edit API base without the environment segment and without a trailing slash (`https://api.shotstack.io/edit`). */
    readonly apiBase: string
    /** How long one call waits. */
    readonly timeoutMs: number
}
