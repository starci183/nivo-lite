/** The outgoing events a webhook connection can receive. */
export const WEBHOOK_EVENTS = [
    "lead.created",
    "deal.won",
    "order.confirmed",
    "payment.received",
    "handoff.requested",
    "decision.made",
] as const

/** One of the outgoing events. */
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

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
