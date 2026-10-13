/** The JSON parameters of one Bot API method call. */
export interface TelegramParams {
    /** Any parameter the method takes, by its Bot API name. */
    readonly [name: string]: unknown
}
