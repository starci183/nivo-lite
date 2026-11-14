import type { Secret } from "@modules/platform/config"

/** The TikTok app (client key + secret) this deployment registered; both are needed only to refresh a user token. */
export interface TiktokAppClient {
    /** `client_key`. */
    readonly clientKey: string
    /** `client_secret`, revealed only where it is posted to TikTok. */
    readonly clientSecret: Secret
}

/** Options of the TikTok integration. */
export interface TiktokOptions {
    /** The API base without a trailing slash (`https://open.tiktokapis.com`; a test fake overrides it). */
    readonly apiBase: string
    /** The app client, or null when this deployment has none (a refresh is then refused before it is sent). */
    readonly client: TiktokAppClient | null
    /** How long one JSON call waits. */
    readonly timeoutMs: number
    /** How long one chunk upload waits. */
    readonly uploadTimeoutMs: number
}
