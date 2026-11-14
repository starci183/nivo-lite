/** Log events of the chat files capability. */
export enum ChatFilesLogEvent {
    /** A file a customer sent could not be kept (the channel's address failed, too large, or not a kept type); the line says so. */
    CustomerFileNotKept = "chat-files.customer_file.not_kept",
}
