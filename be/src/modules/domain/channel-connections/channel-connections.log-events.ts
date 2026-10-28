/** Log events of the channel-connections capability. */
export enum ChannelConnectionsLogEvent {
    /** A Telegram webhook could not be removed while releasing the connection; the disconnect still finishes. */
    TelegramReleaseFailed = "channel-connections.telegram.release_failed",
    /** A SePay delivery could not be written to the connection page event list; the webhook itself was answered. */
    SepayEventNotRecorded = "channel-connections.sepay.event_not_recorded",
}
