/** Options of the Veo integration: tunables only (the API key and the model are per connection). */
export interface VeoOptions {
    /** The Gemini API base, without a trailing slash (`https://generativelanguage.googleapis.com/v1beta`; a test fake overrides it). */
    readonly apiBase: string
    /** How long one JSON call waits. */
    readonly timeoutMs: number
    /** How long a video download waits. */
    readonly mediaTimeoutMs: number
}
