import type { EntityManager } from "typeorm"

/** Whether the money of an event is real. */
export type EventOrigin = "live" | "simulated"

/** One bank credit to record as an inbound payment event. */
export interface BankPaymentEvent {
    /** The transaction that records it: the event joins the caller's transaction. */
    readonly manager: EntityManager
    /** The workspace the credit belongs to. */
    readonly workspaceId: string
    /** Whether the money is real. */
    readonly origin: EventOrigin
    /** The payer name when the bank sent one, or null. */
    readonly sender: string | null
    /** The readable line of the event. */
    readonly body: string
    /** The credited amount in whole VND. */
    readonly amountVnd: number
    /** The transfer content, or null when the bank sent none. */
    readonly externalRef: string | null
    /** The stored event id (`<provider>:<the provider's own id>`): the idempotency key of the event. */
    readonly providerRef: string
}

/** What recording a bank payment event answered. */
export interface BankPaymentRecorded {
    /** True when the same credit had already been recorded: it was counted as a repeat, not recorded twice. */
    readonly duplicate: boolean
    /** The id of the event the credit is, or an empty text when a repeat's event can no longer be read. */
    readonly inboundEventId: string
}
