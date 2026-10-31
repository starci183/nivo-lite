/** What telegramEvents takes. */
export interface ListTelegramEventsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
}
