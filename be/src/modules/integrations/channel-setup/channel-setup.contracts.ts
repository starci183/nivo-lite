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
export interface ZaloSetupPkce {
    /** The PKCE verifier. */
    readonly verifier: string
    /** The one-time state nonce. */
    readonly nonce: string
    /** The expiry instant, epoch milliseconds. */
    readonly exp: number
}

/** The Zalo credential JSON kept sealed in connection_secrets: the app's keys, the tokens and a pending authorization. */
export interface ZaloSetupSecret {
    /** The Zalo app id. */
    readonly appId: string
    /** The Zalo app secret. */
    readonly appSecret: string
    /** The "OA Secret Key" of the webhook settings: signs every webhook (not the same value as the app secret). */
    readonly oaSecret: string
    /** The current access token, once the OA is authorized. */
    readonly accessToken?: string
    /** The provider renewal token (not a session token), once the OA is authorized. */
    readonly renewalToken?: string
    /** When the renewal token stops working, ISO 8601. */
    readonly refreshExpiresAt?: string
    /** A started authorization. */
    readonly pkce?: ZaloSetupPkce
}

/** A Zalo url built from the site url (callback or permission page); null when the deployment has no site url. */
export type OptionalZaloUrl = string | null
