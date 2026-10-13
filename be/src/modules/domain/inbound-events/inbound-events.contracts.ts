import type { EntityManager } from "typeorm"

/** A customer message no agent is bound to answer. */
export interface UnroutedMessage {
    /** The workspace. */
    readonly workspaceId: string
    /** The channel key: telegram or zalo. */
    readonly channel: string
    /** The name of the customer on the channel. */
    readonly sender: string
    /** What the customer wrote. */
    readonly body: string
    /** The channel's own id of the message: the idempotency key. */
    readonly eventId: string
}

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

/** A finished sale handed to the order chain by the capability that served it. */
export interface OrderHandoff {
    /** The workspace. */
    readonly workspaceId: string
    /** Whether the sale is live or simulated. */
    readonly origin: string
    /** The customer name. */
    readonly sender: string
    /** The customer phone or email, or null. */
    readonly contact: string | null
    /** What was sold, in words. */
    readonly body: string
    /** The price in VND. */
    readonly amountVnd: number
    /** The id of the sale in the capability that served it: the idempotency key. */
    readonly ref: string
    /** The lead of the customer, or null. */
    readonly leadId: string | null
}
