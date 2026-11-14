/** Options of the JSON2Video integration: tunables only (the API key is per connection). */
export interface Json2VideoOptions {
    /** The REST base, without a trailing slash (`https://api.json2video.com/v2`; a test fake overrides it). */
    readonly apiBase: string
    /** How long one call waits. */
    readonly timeoutMs: number
}
