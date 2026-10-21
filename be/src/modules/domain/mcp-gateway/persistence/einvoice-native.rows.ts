/** One mail record of the IMAP sync with its attachments. */
export interface InvoiceMailRow {
    /** The data record. */
    readonly id: string
    /** The attachments (a JSON array; a small `.xml` attachment keeps its text under `xml`). */
    readonly attachments: unknown
}
