/** What submitTelegramCode takes. */
export interface SubmitTelegramCodeRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The pending Telegram connection. */
    readonly connectionId: string
    /** The code from Telegram. */
    readonly code: string
}
