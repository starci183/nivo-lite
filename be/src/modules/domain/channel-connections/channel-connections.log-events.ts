/** Log events of the channel-connections capability. */
export enum ChannelConnectionsLogEvent {
    /** A Telegram webhook could not be removed while releasing the connection; the disconnect still finishes. */
    TelegramReleaseFailed = "channel-connections.telegram.release_failed",
}
