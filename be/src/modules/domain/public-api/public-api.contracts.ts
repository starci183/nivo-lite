/** The stages of a customer, in the order of a deal. */
export const LEAD_STAGES = ["new", "qualified", "proposal", "won", "lost"] as const

/** One stage of a customer. */
export type LeadStage = (typeof LEAD_STAGES)[number]

/** The kinds of request the public API accepts into its ledger. */
export type RequestKind = "lead" | "message" | "knowledge"

/** The body of an accepted customer hand-over, as the job reads it from the ledger. */
export interface LeadRequestBody {
    /** The customer's name. */
    readonly name: string
    /** The normalised phone or email, or null. */
    readonly contact: string | null
    /** What the customer needs, or a default text. */
    readonly need: string
    /** The channel the customer came through. */
    readonly channel: string
    /** The company, or an empty string. */
    readonly company: string
    /** A note for the customer's history, or an empty string. */
    readonly note: string
    /** The stage the caller asked for, or null. */
    readonly stage: LeadStage | null
    /** The caller's own id of the customer, or an empty string. */
    readonly externalId: string
    /** The source named in evidence: `api:<key name>`. */
    readonly source: string
}

/** The body of an accepted message request, as the job reads it from the ledger. */
export interface MessageRequestBody {
    /** The customer conversation to message. */
    readonly conversationId: string
    /** The customer of the conversation, or null. */
    readonly leadId: string | null
    /** The text to send. */
    readonly text: string
    /** True forces a waiting decision whatever the owner's rule says. */
    readonly requireApproval: boolean
    /** The source named in evidence: `api:<key name>`. */
    readonly source: string
}

/** The body of an accepted knowledge source, as the job reads it from the ledger; the job writes the source with the ledger id as its id. */
export interface KnowledgeRequestBody {
    /** The source title. */
    readonly title: string
    /** The text of the source. */
    readonly content: string
    /** The topic, or null. */
    readonly topic: string | null
    /** The cleaned tags. */
    readonly tags: ReadonlyArray<string>
    /** Whether customers may be answered from it. */
    readonly visibility: "internal" | "public"
    /** The source named in evidence: `api:<key name>`. */
    readonly source: string
}

/** What recording a request in the ledger answers. */
export interface RecordedRequest {
    /** The ledger row. */
    readonly id: string
    /** The customer a processed hand-over created, or null. */
    readonly lead_id: string | null
    /** True when this call wrote the row, false when the same request had been recorded before. */
    readonly inserted: boolean
}

/** A contact split into the phone and the email it holds, both normalised. */
export interface ContactParts {
    /** The normalised phone, or null. */
    readonly phone: string | null
    /** The normalised email, or null. */
    readonly email: string | null
}

/** What listing customers takes. */
export interface ListLeadsParams {
    /** The Authorization header as sent. */
    readonly authorization: string | undefined
    /** Only customers of this stage. */
    readonly stage?: LeadStage | undefined
    /** The most customers to answer, as the caller wrote it; clamped to 1..200, 50 when absent or not a number. */
    readonly limit?: string | undefined
}

/** What listing events takes. */
export interface ListEventsParams {
    /** The Authorization header as sent. */
    readonly authorization: string | undefined
    /** Only events after this time, ISO 8601; one day back when absent. */
    readonly since?: string | undefined
    /** The most events to answer, as the caller wrote it; clamped to 1..500, 100 when absent or not a number. */
    readonly limit?: string | undefined
}

/** What handing over a customer takes, as the caller sent it: an absent optional text means none. */
export interface AcceptLeadParams {
    /** The Authorization header as sent. */
    readonly authorization: string | undefined
    /** The customer's name. */
    readonly name: string
    /** The phone number. */
    readonly phone?: string | undefined
    /** The email address. */
    readonly email?: string | undefined
    /** The company. */
    readonly company?: string | undefined
    /** What the customer needs. */
    readonly need?: string | undefined
    /** The channel the customer came through; absent means the API. */
    readonly channel?: string | undefined
    /** The caller's own id of the customer: a repeat with the same id is one customer. */
    readonly externalId?: string | undefined
    /** A note for the customer's history. */
    readonly note?: string | undefined
    /** The stage the caller asks for; an empty string means none. */
    readonly stage?: LeadStage | "" | undefined
}

/** A hand-over with every absent text made empty and the stage decided. */
export interface LeadFacts {
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
    /** The channel, the API when the caller named none. */
    readonly channel: string
    /** The caller's own id of the customer, or an empty string. */
    readonly externalId: string
    /** A note, or an empty string. */
    readonly note: string
    /** The stage the caller asked for, or null. */
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
    /** The Authorization header as sent. */
    readonly authorization: string | undefined
    /** The text to send. */
    readonly text: string
    /** The customer conversation; absent when the lead names it. */
    readonly conversationId?: string | undefined
    /** The customer whose latest conversation to use. */
    readonly leadId?: string | undefined
    /** True forces a waiting decision whatever the owner's rule says. */
    readonly requireApproval?: boolean | undefined
    /** The caller's `Idempotency-Key`. */
    readonly idempotencyKey?: string | undefined
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
    /** The Authorization header as sent. */
    readonly authorization: string | undefined
    /** The source title. */
    readonly title: string
    /** The text of the source. */
    readonly content: string
    /** The topic. */
    readonly topic?: string | undefined
    /** `public` lets customers be answered from it; anything else keeps it internal. */
    readonly visibility?: string | undefined
    /** The tags. */
    readonly tags?: ReadonlyArray<string> | undefined
}

/** What adding a knowledge source answers: the source waits to be indexed. */
export interface AcceptedKnowledge {
    /** The request id: the knowledge source the job writes has this id. */
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
