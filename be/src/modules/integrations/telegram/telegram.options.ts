/** Options of the Telegram integration. */
export interface TelegramOptions {
    /** The origin of the Bot API, without a trailing slash. */
    readonly apiBase: string
    /** How long one Bot API call waits for the answer. */
    readonly timeoutMs: number
}
