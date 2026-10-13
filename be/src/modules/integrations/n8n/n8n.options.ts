import type { Secret } from "@modules/platform/config"

/** What the n8n integration needs from its environment. */
export interface N8nOptions {
    /** The secret every workspace key is derived from; the receiver verifies deliveries with the derived key. */
    readonly signingSecret: Secret
    /** The base url the webhook paths of the templates hang under (the n8n service inside the compose network), for example `http://n8n:5678/webhook`. */
    readonly webhookBase: string | undefined
    /** Hosts allowed although they resolve to a private address (the n8n service name); everything else must resolve to a public address. */
    readonly allowedHosts: ReadonlyArray<string>
    /** How long one post may take, in milliseconds. */
    readonly timeoutMs: number
}
