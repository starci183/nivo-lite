/** One mail row of the hub with the attachments the IMAP sync kept on it. */
export interface MailAttachments {
    /** The hub row. */
    readonly id: string
    /** The attachments (a JSON array; a small `.xml` attachment keeps its text under `xml`). */
    readonly attachments: unknown
}
