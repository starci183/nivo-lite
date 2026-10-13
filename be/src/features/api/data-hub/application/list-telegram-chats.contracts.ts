/** What listTelegramChats takes. */
export interface ListTelegramChatsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The Telegram connection. */
    readonly connectionId: string
}
