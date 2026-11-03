/** Log events of the chat files capability. */
export enum ChatFilesLogEvent {
    /** A file could not be read; its amount stays missing. */
    ReadFailed = "chat-files.read.failed",
    /** A file a channel brought in was left out of the message: it could not be downloaded or read, was not an accepted type, was too large or did not fit the plan. */
    InboundSkipped = "chat-files.inbound.skipped",
}
