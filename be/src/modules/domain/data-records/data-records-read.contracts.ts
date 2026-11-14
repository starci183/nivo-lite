/** One mail of a mailbox (an `imap.mail` row) with the attachments the IMAP sync kept on it. */
export interface MailAttachments {
    /** The row id. */
    readonly id: string
    /** The attachments (a JSON array; a small `.xml` attachment keeps its text under `xml`). */
    readonly attachments: unknown
}

/** A mail row, or none when the workspace has no such mail. */
export type OptionalMailAttachments = MailAttachments | undefined

/** The day (`YYYY-MM-DD`) a mail read starts from, or none for the whole history. */
export type OptionalSinceDay = string | undefined

/**
 * Where a read of a mailbox's mails stands: the mail last handed over, by the moment it first entered the account's store (text with
 * microseconds; a read answers it fixed-width in UTC, `2026-11-11T10:00:00.123456Z`, and an older Postgres text is still taken back) and
 * its row id. Mails are read in that order.
 */
export interface HubPoint {
    /** `account_data.created_at` of the row, as text. */
    readonly seenAt: string
    /** The row id. */
    readonly id: string
}

/** A point to read after, or none to read from the first row. */
export type OptionalHubPoint = HubPoint | null

/** The fields every mail row read carries: its place in the store and what the IMAP sync kept, without the text. */
interface MailRowBase extends HubPoint {
    /** The mailbox (data-hub connection) the mail was synced from. */
    readonly connectionId: string
    /** When it was sent (or received), or null. */
    readonly occurredAt: Date | string | null
    /** The fields the sync kept (`from`, `to`, `cc`, `subject`, `messageId`, `inReplyTo`, `truncated`, `unreadable`), minus the text. */
    readonly head: unknown
    /** The attachments as name / type / size, minus any attachment text the sync kept. */
    readonly attachments: unknown
}

/** One mail row as a list reads it: the head and the opening of the text. */
export interface MailHeadRow extends MailRowBase {
    /** The first characters of the text, or null when the sync kept none. */
    readonly opening: string | null
}

/** One mail row read whole: the head and the text the sync kept. */
export interface MailFullRow extends MailRowBase {
    /** The text the sync kept (plain text; an HTML-only mail was stripped of its tags at sync), or null. */
    readonly text: string | null
}

/** A mail row read whole, or none when no allowed mailbox holds it. */
export type OptionalMailFullRow = MailFullRow | undefined

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
