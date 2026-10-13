/** The outgoing events a webhook connection can receive. */
export const WEBHOOK_EVENTS = [
    "lead.created",
    "deal.won",
    "order.confirmed",
    "payment.received",
    "handoff.requested",
    "decision.made",
] as const satisfies ReadonlyArray<WebhookEvent>

/** One of the outgoing events: the name a subscriber filters on and the delivery carries. */
export type WebhookEvent =
    "lead.created" | "deal.won" | "order.confirmed" | "payment.received" | "handoff.requested" | "decision.made"

/** What starting a webhook connection takes. */
export interface StartWebhookInput {
    /** The name the owner gives the connection. */
    readonly name: string
    /** The receiver address. */
    readonly url: string
    /** The picked events. */
    readonly events: ReadonlyArray<string>
}

/** The wizard view of a webhook connection. */
export interface WebhookView {
    /** The id of the connection. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The host of the receiver. */
    readonly host: string
    /** The events it receives. */
    readonly events: ReadonlyArray<WebhookEvent>
    /** The per-workspace signing secret to copy into the receiver. */
    readonly signingSecret: string
}

/** What a signed test delivery answered. */
export interface WebhookTestResult {
    /** True when the receiver answered 2xx. */
    readonly ok: boolean
    /** The status the receiver answered, null when none did. */
    readonly status: number | null
    /** Why the test failed (HTTP_STATUS, TIMEOUT or UNREACHABLE), null on success. */
    readonly error: "HTTP_STATUS" | "TIMEOUT" | "UNREACHABLE" | null
    /** How long it took, in milliseconds. */
    readonly durationMs: number
}

/** What a business event carries to its receivers. */
export interface WebhookEventData {
    /** Any value the event carries. */
    readonly [name: string]: unknown
}

/** One occurrence of a business event to publish to the subscribed webhooks. */
export interface WebhookPublication {
    /** The workspace the event happened in. */
    readonly workspaceId: string
    /** The event. */
    readonly event: WebhookEvent
    /** What it carries. */
    readonly data: WebhookEventData
    /** Names the occurrence: publishing it twice queues nothing twice. */
    readonly dedupe: string
}
