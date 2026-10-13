import type { Secret } from "@modules/platform/config"

/** The OAuth client Google issued for this deployment. */
export interface GoogleOAuthClient {
    /** The public client id. */
    readonly clientId: string
    /** The client secret, revealed only where it is posted to Google. */
    readonly clientSecret: Secret
}

/** Options of the google integration, parsed once at boot. */
export interface GoogleOptions {
    /** The OAuth client; null when this deployment has none (the connection is then reported as unavailable). */
    readonly client: GoogleOAuthClient | null
    /** One base replacing accounts.google.com and oauth2.googleapis.com (a local fake), when set. */
    readonly oauthBase: string | undefined
    /** The Sheets API base (a local fake), when set. */
    readonly sheetsBase: string | undefined
    /** The public origin of the site, used for the OAuth redirect uri; undefined disables the consent. */
    readonly siteUrl: string | undefined
    /** The channel token key (32 bytes, base64) the OAuth state signing key is derived from. */
    readonly channelTokenKey: Secret
    /** How long one Google call waits for the answer. */
    readonly timeoutMs: number
}
