/** The steps of the webhook wizard, in order. */
export const WEBHOOK_STEPS = ["address", "secret", "test", "done"] as const

/** The events an outgoing webhook can be sent (their plain-words names live in the `webhookWizard` catalog). */
export const WEBHOOK_EVENTS = [
    "lead.created",
    "deal.won",
    "order.confirmed",
    "payment.received",
    "handoff.requested",
    "decision.made",
] as const

/** One of the events an outgoing webhook can be sent. */
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]
