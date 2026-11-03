/** Log events of the Zalo inbox. */
export enum ZaloInboxLogEvent {
    /** A picture or file event had no attachment the parser could read; the names of its fields (never their values) ride in the fields, once per process. */
    AttachmentShapeUnknown = "zalo-inbox.attachment.shape-unknown",
}
