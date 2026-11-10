/** The JSON parameters of one Bot API method call. */
export interface TelegramParams {
    /** Any parameter the method takes, by its Bot API name. */
    readonly [name: string]: unknown
}

/** One picture of an album: the public address Telegram fetches it from and the caption under it (empty for none). */
export interface TelegramPhoto {
    /** The public address. */
    readonly url: string
    /** The caption, at most what Telegram allows. */
    readonly caption: string
}
