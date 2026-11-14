/** Options of the Creatomate integration: tunables only (the API key is per connection). */
export interface CreatomateOptions {
    /** The REST base, without a trailing slash (`https://api.creatomate.com`; a test fake overrides it). */
    readonly apiBase: string
    /** How long one call waits. */
    readonly timeoutMs: number
}
