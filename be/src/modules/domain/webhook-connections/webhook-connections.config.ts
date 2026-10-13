import type { EnvSource } from "@modules/platform/config"
import type { WebhookConnectionsOptions } from "./webhook-connections.options"

/** Reads the webhook-connections options: the shared secret is optional (without it webhook signing is unavailable). */
export const parseWebhookConnectionsConfig = (env: EnvSource): WebhookConnectionsOptions => ({
    engineSharedSecret: env.has("ENGINE_SHARED_SECRET") ? env.secret("ENGINE_SHARED_SECRET") : undefined,
})
