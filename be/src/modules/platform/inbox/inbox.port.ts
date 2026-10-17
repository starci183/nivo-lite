import type { EntityManager } from "typeorm"
import type { sql } from "@modules/platform/database"

/** The provider-owned receipt insert, executed with the claim in the caller transaction. */
export interface InboxReceipt {
    /** The provider receipt SQL, returning the inserted identity only to the winning claim. */
    readonly insert: ReturnType<typeof sql>
    /** The receipt data the deferred consumer needs, excluding authentication credentials. */
    readonly payload: object
}

/** The inbox port: a delivery method claims `(source, eventId)` before it acts, so a repeat can be told from a first delivery. */
export interface Inbox {
    /**
     * Claims one delivery. True when this pair is new; false when it was already claimed.
     * `source` names the door, `eventId` is the sender's id of the delivery.
     */
    claim(source: string, eventId: string): Promise<boolean>
    /** Persists a provider receipt in the same transaction as its outbox publication. */
    claim(source: string, eventId: string, manager: EntityManager, receipt: InboxReceipt): Promise<boolean>
}
