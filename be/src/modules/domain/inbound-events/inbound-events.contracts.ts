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

/** One bank credit to record as an inbound payment event. */
export interface BankPaymentEvent {
    /** The transaction that records it: the event joins the caller's transaction. */
    readonly manager: EntityManager
    /** The workspace the credit belongs to. */
    readonly workspaceId: string
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
    /** True when the same event had already been recorded, so no second event was created. */
    readonly duplicate: boolean
    /** The durable event id; recording fails when a repeat's event cannot be read. */
    readonly inboundEventId: string
}

/** A finished sale handed to the order chain by the capability that served it. */
export interface OrderHandoff {
    /** The workspace. */
    readonly workspaceId: string
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

/** Where an inbound event stands. */
export type EventStatus = "received" | "processed" | "needs_decision" | "failed"

/** A status to set, or null to keep the current one. */
export type OptionalEventStatus = EventStatus | null

/** An id, or null when there is none. */
export type OptionalLeadRef = string | null

/** An inbound event, or null when the workspace has no such event. */
export type OptionalInboundEvent = InboundEventDetail | null

/** An input a channel delivered, as the engine records it. */
export interface InboundInput {
    /** The workspace. */
    readonly workspaceId: string
    /** The channel key. */
    readonly channel: string
    /** `message`, `lead`, `order` or `payment`. */
    readonly kind: string
    /** The sender's name, or null. */
    readonly senderName: string | null
    /** The sender's phone or email, or null. */
    readonly senderContact: string | null
    /** The text. */
    readonly body: string
    /** The external reference, or null. */
    readonly externalRef: string | null
    /** The channel's own event id: the idempotency key. */
    readonly eventId: string
}

/** An inbound event as the engine reads it. */
export interface InboundEventDetail {
    /** The event id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The channel key. */
    readonly channel: string
    /** The kind of input. */
    readonly kind: string
    /** The sender's name. */
    readonly sender_name: string | null
    /** The sender's phone or email. */
    readonly sender_contact: string | null
    /** The text. */
    readonly body: string
    /** The money in it, VND. */
    readonly amount_vnd: number | null
    /** The external reference. */
    readonly external_ref: string | null
    /** The channel's own event id. */
    readonly event_id: string | null
    /** The customer it belongs to. */
    readonly lead_id: string | null
    /** Where it stands. */
    readonly status: string
}

/** A received input with feed timestamps and repeat-delivery counts. */
export interface InboundEventFeedRow extends InboundEventDetail {
    /** How many duplicate deliveries have been blocked. */
    readonly duplicate_count: number
    /** When this event was first received, as ISO 8601 text. */
    readonly created_at: string
}
