/** Options of the ElevenLabs integration: tunables only (the API key is per connection, stored sealed). */
export interface ElevenLabsOptions {
    /** The origin of the API, without a trailing slash (`https://api.elevenlabs.io`; a residency server or a test fake overrides it). */
    readonly apiBase: string
    /** How long one JSON call waits. */
    readonly timeoutMs: number
    /** How long a call that answers audio or video bytes waits. */
    readonly mediaTimeoutMs: number
}
