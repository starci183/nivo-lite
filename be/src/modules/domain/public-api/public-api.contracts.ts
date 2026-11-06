/** The kinds of request the public API accepts into its ledger. */
export type RequestKind = "message" | "knowledge"

/** The body of an accepted message request, as the job reads it from the ledger. */
export interface MessageRequestBody {
    /** The customer conversation to message. */
    readonly conversationId: string
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
    /** Always internal: customers are answered from a public document an owner approved, never from an API-added source. */
    readonly visibility: "internal"
    /** The source named in evidence: `api:<key name>`. */
    readonly source: string
}

/** What recording a request in the ledger answers. */
export interface RecordedRequest {
    /** The ledger row. */
    readonly id: string
    /** True when this call wrote the row, false when the same request had been recorded before. */
    readonly inserted: boolean
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

/** What asking the chatbot to message a customer takes. */
export interface AcceptMessageParams {
    /** The Authorization header as sent. */
    readonly authorization: string | undefined
    /** The text to send. */
    readonly text: string
    /** The customer conversation. */
    readonly conversationId: string
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
