/** What a hub row is about. */
export type DataEntity = "customer" | "order" | "product" | "transaction" | "message" | "document" | "other"

/** One row for the hub; re-syncing the same external id updates the row. */
export interface DataRecordInput {
    /** The source's own stable id (a row key, an API id, a message id). */
    readonly externalId: string
    /** One human line: a name, an order number, a subject. */
    readonly title?: string
    /** When it happened at the source, when known. */
    readonly occurredAt?: string | Date | null
    /** The mapped fields. */
    readonly data: Readonly<Record<string, unknown>>
}
