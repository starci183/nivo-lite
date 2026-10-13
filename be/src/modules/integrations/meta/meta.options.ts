import type { Secret } from "@modules/platform/config"

/** The Meta app credentials of this deployment. */
export interface MetaApp {
    /** The public app id. */
    readonly appId: string
    /** The app secret: signs webhook deliveries and authenticates app-level calls. */
    readonly appSecret: Secret
}

/** Options of the meta integration, parsed once at boot. */
export interface MetaOptions {
    /** The Meta app; null when this deployment has none (the connector is then reported as unavailable). */
    readonly app: MetaApp | null
    /** The token Meta echoes back when it verifies the webhook callback. */
    readonly webhookVerifyToken: Secret | undefined
    /** The Facebook Login for Business configuration id; the classic scope list is used without it. */
    readonly loginConfigId: string | undefined
    /** The Graph API version asked for (`v21.0` or later); anything older or malformed falls back to `v21.0`. */
    readonly graphVersion: string | undefined
    /** The public origin of the site, used for the OAuth redirect uri and the webhook callback. */
    readonly siteUrl: string | undefined
    /** The channel token key (32 bytes, base64) the OAuth state signing key is derived from. */
    readonly channelTokenKey: Secret
    /** How many messages one Page may send per minute before the client refuses locally. */
    readonly sendPerMinute: number
    /** How long one Graph call waits for the answer. */
    readonly timeoutMs: number
}
