/** Options of the YouTube integration: tunables only (the access token is per connection). */
export interface YoutubeOptions {
    /** The Google APIs origin, without a trailing slash (`https://www.googleapis.com`; a test fake overrides it). */
    readonly apiBase: string
    /** How long one JSON call waits. */
    readonly timeoutMs: number
    /** How long the upload of the file waits. */
    readonly uploadTimeoutMs: number
    /** NIVO's own cap on a video held in memory for one upload, in bytes (YouTube's documented maximum is 256GB). */
    readonly maxUploadBytes: number
}
