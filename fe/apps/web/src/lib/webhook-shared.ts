/** Client-safe facts about the outgoing webhook events (the wizard lists them; outbound-events.ts delivers them). Their plain-words names live in the `webhookWizard` catalog. */
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

/** Whether the value is one of the outgoing webhook events. */
export const isWebhookEvent = (v: unknown): v is WebhookEvent =>
    typeof v === "string" && (WEBHOOK_EVENTS as ReadonlyArray<string>).includes(v)
