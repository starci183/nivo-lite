/** What submitTelegramPassword takes. */
export interface SubmitTelegramPasswordRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The pending Telegram connection. */
    readonly connectionId: string
    /** The two-step verification password; used once, never stored. */
    readonly password: string
}
