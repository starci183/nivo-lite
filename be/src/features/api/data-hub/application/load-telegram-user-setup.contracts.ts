/** What loadTelegramUserSetup takes. */
export interface LoadTelegramUserSetupRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The Telegram connection. */
    readonly connectionId: string
}
