import type { EntityManager, EntityTarget, ObjectLiteral } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"

/** The signed provider header may omit its delivery identity; the adapter refuses that delivery. */
export type InboxEventId = string | undefined

/** Deduplicates a delivery inside the transaction that records its receipt or applies its effect. */
export interface Inbox {
    /** Claims once per source and event id; a rolled-back transaction gives the claim back automatically. */
    claim(source: string, eventId: InboxEventId, tx: EntityManager): Promise<boolean>
}

/** A provider's receipt row: its entity, mapping a table with an `id` column, and the complete row, delivery key and payload included. */
export interface InboxEntityReceipt<Row extends ObjectLiteral> {
    /** The provider's receipt entity. */
    readonly entity: EntityTarget<Row>
    /**
     * The row the receipt holds, built from the delivery id the claim normalized (trimmed, never missing), so the receipt keys
     * exactly what was claimed; the deferred consumer reads it, so it carries no credential.
     */
    readonly row: (deliveryId: string) => QueryDeepPartialEntity<Row>
}

/** The id of the receipt row a winning claim inserted; undefined when the delivery was a repeat or its receipt already existed. */
export type InboxReceiptId = string | undefined

/** The inbox of a capability whose provider receipt is an entity row, so it records the receipt without raw SQL. */
export interface EntityInbox extends Inbox {
    /**
     * Claims once per source and event id, then inserts the receipt row, both in the caller transaction. Answers the id the
     * winning insert returned; a repeated delivery, or a receipt row that already exists, inserts nothing and answers undefined.
     */
    claimRow<Row extends ObjectLiteral>(
        source: string,
        eventId: InboxEventId,
        tx: EntityManager,
        receipt: InboxEntityReceipt<Row>,
    ): Promise<InboxReceiptId>
}
