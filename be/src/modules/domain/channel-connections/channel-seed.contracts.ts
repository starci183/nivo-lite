/** The Telegram bot of a seeded workspace; an absent token leaves the connection without credentials. */
export interface SeedTelegram {
    /** The id the connection keeps in every environment. */
    readonly id: string
    /** The bot token from @BotFather. */
    readonly token?: string | undefined
    /**
     * The secret Telegram echoes in `X-Telegram-Bot-Api-Secret-Token` (setWebhook `secret_token`: 1-256 of `A-Z a-z 0-9 _ -`), sealed by
     * name so a dev webhook mock can prove its deliveries; absent keeps the connection's own random one.
     */
    readonly webhookSecret?: string | undefined
}

/** The Zalo OA of a seeded workspace; an absent value leaves the connection in the state that misses it. */
export interface SeedZaloOa {
    /** The id the connection keeps in every environment. */
    readonly id: string
    /** The Zalo app id. */
    readonly appId?: string | undefined
    /** The Zalo app secret. */
    readonly appSecret?: string | undefined
    /** The OA secret key; a value that starts with `PENDING-` counts as absent. */
    readonly oaSecret?: string | undefined
}

/** The SePay feed of a seeded workspace. */
export interface SeedSepay {
    /** The id the connection keeps in every environment. */
    readonly id: string
    /** The bank code of the account the feed watches. */
    readonly bankCode?: string | undefined
    /** The account number. */
    readonly accountNumber?: string | undefined
    /** The account holder. */
    readonly holder?: string | undefined
    /** The webhook API key (`nivo_` and 64 hex); an absent one is generated once, for a new connection only. */
    readonly apiKey?: string | undefined
    /** The SePay user-API token NIVO reads the feed with (a different secret from the webhook key); absent leaves the stored one. */
    readonly apiToken?: string | undefined
}

/** The payOS feed of a seeded workspace. */
export interface SeedPayos {
    /** The id the connection keeps in every environment. */
    readonly id: string
    /** The payOS client id. */
    readonly clientId?: string | undefined
    /** The payOS API key. */
    readonly apiKey?: string | undefined
    /** The payOS checksum key. */
    readonly checksumKey?: string | undefined
}

/**
 * The Google OAuth client of a seeded workspace. Both values or none: with none no Google connection is seeded. Google issues the
 * tokens only to the owner who consents, so the seeded connection waits for that consent and never holds a token before it.
 */
export interface SeedGoogle {
    /** The id the connection keeps in every environment. */
    readonly id: string
    /** The OAuth client id. */
    readonly clientId?: string | undefined
    /** The OAuth client secret. */
    readonly clientSecret?: string | undefined
}

/** The connections of a seeded workspace. */
export interface ChannelSeed {
    /** The Telegram bot. */
    readonly telegram: SeedTelegram
    /** The Zalo OA. */
    readonly zaloOa: SeedZaloOa
    /** The SePay feed. */
    readonly sepay: SeedSepay
    /** The payOS feed. */
    readonly payos: SeedPayos
    /** The Google account connection; absent or without its OAuth client, none is seeded. */
    readonly google?: SeedGoogle | undefined
}

/** What one seeded connection ended as; never a value. */
export interface SeededConnection {
    /** The provider. */
    readonly provider: "telegram" | "zalo_oa" | "sepay" | "payos" | "google"
    /** The connection id. */
    readonly id: string
    /** Whether the row was made now or already existed. */
    readonly action: "created" | "kept"
    /** Whether the connection holds its credentials or still misses them. */
    readonly credentials: "saved" | "missing"
    /** For a Google connection only: `needed` until the owner has consented once, `given` after. */
    readonly consent?: "needed" | "given"
}
