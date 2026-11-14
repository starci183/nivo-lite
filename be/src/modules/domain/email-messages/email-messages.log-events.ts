/** Log events of the email-messages capability. */
export enum EmailMessagesLogEvent {
    /** The sealed SMTP credential of a connection could not be read. */
    Undecryptable = "email_messages.credential_unreadable",
    /** A module notice could not be sent or recorded. */
    NoticeFailed = "email_messages.notice_failed",
    /** A send through a workspace SMTP connection could not be kept in the connection's account data (the send stands). */
    AccountKeepFailed = "email_messages.account_keep_failed",
}
