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

/** What recording an inbound input answered. */
export interface InboundRecorded {
    /** True when the same event had already been recorded, so no second event was created. */
    readonly duplicate: boolean
    /** The durable event id; recording fails when a repeat's event cannot be read. */
    readonly inboundEventId: string
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
    /** `message` or `lead`. */
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
    /** The customer the input groups under when it names no lead yet, or null. */
    readonly customerKey?: string | null
    /** Where the input came from (page, campaign, device), or nothing. */
    readonly source?: Readonly<Record<string, string>>
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
