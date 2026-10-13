/** The bot Telegram's getMe answered. */
export interface TelegramBot {
    /** The numeric bot id. */
    readonly id: string
    /** The bot username, empty when Telegram sent none. */
    readonly username: string
}

/** What Telegram knows about the bot's webhook. */
export interface TelegramWebhookInfo {
    /** The address Telegram calls, empty when none is set. */
    readonly url: string
    /** Updates waiting to be delivered. */
    readonly pendingUpdateCount: number
    /** The last delivery error, when there is one. */
    readonly lastErrorMessage: string | null
}

/** What the payOS confirm-webhook call needs. */
export interface PayosCredential {
    /** The channel's client id. */
    readonly clientId: string
    /** The channel's API key. */
    readonly apiKey: string
}

/** The pending Zalo authorization stored with the credential. */
export interface ZaloPkce {
    /** The PKCE verifier. */
    readonly verifier: string
    /** The one-time state nonce. */
    readonly nonce: string
    /** The expiry instant, epoch milliseconds. */
    readonly exp: number
}

/** The Zalo credential JSON kept sealed in connection_secrets: the app's keys, the tokens and a pending authorization. */
export interface ZaloSecret {
    /** The Zalo app id. */
    readonly appId: string
    /** The Zalo app secret. */
    readonly appSecret: string
    /** The "OA Secret Key" of the webhook settings: signs every webhook (not the same value as the app secret). */
    readonly oaSecret: string
    /** The current access token, once the OA is authorized. */
    readonly accessToken?: string
    /** The refresh token, once the OA is authorized. */
    readonly refreshToken?: string
    /** When the refresh token stops working, ISO 8601. */
    readonly refreshExpiresAt?: string
    /** A started authorization. */
    readonly pkce?: ZaloPkce
}

/** How long a started Zalo authorization stays valid, in milliseconds. */
export const ZALO_PKCE_TTL_MS = 15 * 60_000
