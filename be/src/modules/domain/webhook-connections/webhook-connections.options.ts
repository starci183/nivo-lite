import type { Secret } from "@modules/platform/config"

/** Options of the webhook-connections capability. */
export interface WebhookConnectionsOptions {
    /** The secret the console derives per-workspace webhook signing keys from; absent switches signing off. */
    readonly signingSecret: Secret | undefined
}
