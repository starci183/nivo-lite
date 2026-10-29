/** One mail row of the hub with the attachments the IMAP sync kept on it. */
export interface MailAttachments {
    /** The hub row. */
    readonly id: string
    /** The attachments (a JSON array; a small `.xml` attachment keeps its text under `xml`). */
    readonly attachments: unknown
}

/** A mail row, or none when the workspace has no such mail. */
export type OptionalMailAttachments = MailAttachments | undefined

/** The day (`YYYY-MM-DD`) a mail read starts from, or none for the whole history. */
export type OptionalSinceDay = string | undefined

/** One customer row of the hub: the connection it was synced from and its columns. */
export interface CustomerRecordRows {
    /** The data-hub connection the row was synced from. */
    readonly connectionId: string
    /** The id of the row in its source. */
    readonly externalId: string
    /** The display title of the row. */
    readonly title: string
    /** The columns of the row, keyed by their header. */
    readonly data: Readonly<Record<string, unknown>>
}
