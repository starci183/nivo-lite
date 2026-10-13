import type { Secret } from "@modules/platform/config"

/** Options of the webhook-connections capability. */
export interface WebhookConnectionsOptions {
    /** The secret the engine and the console derive per-workspace webhook signing keys from; absent switches signing off. */
    readonly engineSharedSecret: Secret | undefined
}
