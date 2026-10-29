import type { EntityManager, EntityTarget, ObjectLiteral } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import type { sql } from "@modules/platform/database"

/** The provider-owned receipt insert as raw SQL; retained only until the capabilities that still pass it move to `claimRow`. */
export interface InboxReceipt {
    /** The provider receipt SQL, returning the inserted identity only to the winning claim. */
    readonly insert: ReturnType<typeof sql>
    /** The receipt data the deferred consumer needs, excluding authentication credentials. */
    readonly payload: object
}

/** The provider-owned receipt row, inserted with `ON CONFLICT DO NOTHING` in the caller transaction. */
export interface InboxEntityReceipt {
    /** The provider's receipt entity; it must have an `id` column that the winning insert returns. */
    readonly entity: EntityTarget<ObjectLiteral>
    /** The complete row of the receipt, including its delivery key and the data the deferred consumer needs. */
    readonly row: QueryDeepPartialEntity<ObjectLiteral>
}

/** The inbox port: a delivery method claims `(source, eventId)` before it acts, so a repeat can be told from a first delivery. */
export interface Inbox {
    /**
     * Claims one delivery. True when this pair is new; false when it was already claimed.
     * `source` names the door, `eventId` is the sender's id of the delivery.
     * A supplied manager keeps the claim in the same transaction as the domain action.
     */
    claim(source: string, eventId: string, manager?: EntityManager): Promise<boolean>
    /** Persists a provider receipt in the same transaction as its outbox publication. */
    claim(source: string, eventId: string, manager: EntityManager, receipt: InboxReceipt): Promise<boolean>
}

/** The inbox of capabilities whose provider receipt is an entity row rather than raw SQL. */
export interface EntityInbox extends Inbox {
    /**
     * Claims one delivery by inserting the provider's receipt entity row in the caller transaction.
     * True only for the insert that won; a repeat inserts nothing and returns false.
     */
    claimRow(source: string, eventId: string, manager: EntityManager, receipt: InboxEntityReceipt): Promise<boolean>
}
