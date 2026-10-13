import type { EnvSource } from "@modules/platform/config"
import type { WebhookDeliveryOptions } from "./webhook-delivery.options"

/** Reads the webhook-delivery options: the deadline is a tunable with a literal default. */
export const parseWebhookDeliveryConfig = (env: EnvSource): WebhookDeliveryOptions => ({
    timeoutMs: env.duration("WEBHOOK_DELIVERY_TIMEOUT", 10_000),
})
