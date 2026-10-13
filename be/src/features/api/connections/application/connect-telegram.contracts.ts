/** What connectTelegram takes. */
export interface ConnectTelegramRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The name the owner gives the connection. */
    readonly name: string
    /** The bot token from @BotFather. */
    readonly token: string
}
