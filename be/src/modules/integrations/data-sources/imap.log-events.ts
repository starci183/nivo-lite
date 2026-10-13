/** Log events of the IMAP client. */
export enum ImapLogEvent {
    /** The mailbox did not log out cleanly; the connection was dropped instead. */
    LogoutFailed = "data_sources.imap_logout_failed",
    /** One message could not be parsed and was stored as unreadable. */
    MessageUnreadable = "data_sources.imap_message_unreadable",
}
