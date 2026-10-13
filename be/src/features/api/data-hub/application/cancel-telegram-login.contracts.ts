/** What cancelTelegramLogin takes. */
export interface CancelTelegramLoginRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The Telegram connection. */
    readonly connectionId: string
}
