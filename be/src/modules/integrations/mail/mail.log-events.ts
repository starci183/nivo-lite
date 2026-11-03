/** Log events owned by the mail integration. */
export enum MailLogEvent {
    /** A message to a recipient on the suppress list never reached the mail server; the recipient is masked. */
    Suppressed = "mail.suppressed",
    /** A suppressed message could not be written to the development outbox. */
    OutboxFailed = "mail.outbox_failed",
}
