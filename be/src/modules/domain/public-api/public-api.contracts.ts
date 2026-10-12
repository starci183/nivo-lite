/** The stages of a customer, in the order of a deal. */
export const LEAD_STAGES = ["new", "qualified", "proposal", "won", "lost"] as const

/** One stage of a customer. */
export type LeadStage = (typeof LEAD_STAGES)[number]

/** What handing over a customer takes; an absent optional text is an empty string. */
export interface AcceptLeadParams {
    /** The customer's name. */
    readonly name: string
    /** The phone number, or an empty string. */
    readonly phone: string
    /** The email address, or an empty string. */
    readonly email: string
    /** The company, or an empty string. */
    readonly company: string
    /** What the customer needs, or an empty string. */
    readonly need: string
    /** The channel the customer came through; empty means the API. */
    readonly channel: string
    /** The caller's own id of the customer: a repeat with the same id is one customer. */
    readonly externalId: string
    /** A note for the customer's history, or an empty string. */
    readonly note: string
    /** The stage the caller asks for, or null. */
    readonly stage: LeadStage | null
}

/** What handing over a customer answers. */
export interface AcceptedLead {
    /** The customer already known by phone, email or name, or null until the hand-off creates one. */
    readonly leadId: string | null
    /** `accepted` when the hand-off was queued, `unchanged` when the same external id was already handed over. */
    readonly status: "accepted" | "unchanged"
}

/** What asking the chatbot to message a customer takes. */
export interface AcceptMessageParams {
    /** The text to send. */
    readonly text: string
    /** The customer conversation, or an empty string when the lead names it. */
    readonly conversationId: string
    /** The customer whose latest conversation to use, or an empty string. */
    readonly leadId: string
    /** True forces a waiting decision whatever the owner's rule says. */
    readonly requireApproval: boolean
    /** The caller's `Idempotency-Key`, or null. */
    readonly idempotencyKey: string | null
}

/** What asking the chatbot to message a customer answers: the message waits in the queue. */
export interface AcceptedMessage {
    /** The conversation the message goes to. */
    readonly conversationId: string
    /** The message is queued; the owner's authority rule decides whether it is sent or waits for a decision. */
    readonly status: "queued"
}

/** What adding a knowledge source takes. */
export interface AcceptKnowledgeParams {
    /** The source title. */
    readonly title: string
    /** The text of the source. */
    readonly content: string
    /** The topic, or an empty string. */
    readonly topic: string
    /** Whether customers may be answered from it. */
    readonly visibility: "internal" | "public"
    /** Up to twelve tags. */
    readonly tags: ReadonlyArray<string>
}

/** What adding a knowledge source answers: the source waits to be indexed. */
export interface AcceptedKnowledge {
    /** The source id. */
    readonly id: string
    /** The source is queued for indexing. */
    readonly status: "queued"
}

/** One customer as the public API lists it. */
export interface LeadListItem {
    /** The customer id. */
    readonly id: string
    /** The customer's name. */
    readonly name: string
    /** The company. */
    readonly company: string
    /** The channel. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** The stage. */
    readonly stage: string
    /** The phone number, or null. */
    readonly phone: string | null
    /** The email address, or null. */
    readonly email: string | null
    /** When the customer was created, ISO 8601. */
    readonly createdAt: string
}

/** One evidence line as the public API lists it. */
export interface EventListItem {
    /** The event id. */
    readonly id: string
    /** The event kind, e.g. `api.lead`. */
    readonly kind: string
    /** Who did it. */
    readonly actor: string
    /** One line telling what happened. */
    readonly summary: string
    /** The evidence, clipped to 500 characters, or null. */
    readonly evidence: string | null
    /** The customer it is about, or null. */
    readonly leadId: string | null
    /** When it happened, ISO 8601. */
    readonly createdAt: string
}

/** A page of events and the cursor to pass as `since` next time. */
export interface EventsPage {
    /** The events after `since`, oldest first. */
    readonly events: ReadonlyArray<EventListItem>
    /** The time of the last event, or the start of the window when there was none. */
    readonly nextSince: string
}
