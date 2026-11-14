/** Log events of the Telegram inbox: ids, codes and reasons only, never the words of a customer or a file address (it carries the bot token). */
export enum TelegramInboxLogEvent {
    /** A picture or file of a customer message got no download address; it stays on the line as a file nobody saw. */
    FileNotAddressed = "telegram_inbox.file_not_addressed",
    /** An update arrived for a connection id nobody holds: it is acknowledged and nothing is kept. */
    UnknownConnection = "telegram_inbox.unknown_connection",
}
