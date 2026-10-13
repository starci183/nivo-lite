/** What resendTelegramCode takes. */
export interface ResendTelegramCodeRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The pending Telegram connection. */
    readonly connectionId: string
}
