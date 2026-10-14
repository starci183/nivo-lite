import type { EnvSource } from "@modules/platform/config"
import type { WebhookConnectionsOptions } from "./webhook-connections.options"

/** Reads the webhook-connections options: the signing secret is optional (without it webhook signing is unavailable). */
export const parseWebhookConnectionsConfig = (env: EnvSource): WebhookConnectionsOptions => ({
    signingSecret: env.has("WEBHOOK_SIGNING_SECRET") ? env.secret("WEBHOOK_SIGNING_SECRET") : undefined,
})
