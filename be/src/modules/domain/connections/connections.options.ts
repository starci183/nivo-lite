import type { Secret } from "@modules/platform/config"

/** Connections configuration parsed once at API boot. */
export interface ConnectionsOptions {
    /** The AES-256-GCM key (32 bytes, base64) that seals every stored provider credential. */
    readonly channelTokenKey: Secret
    /** The required site URL used to build addresses when no public override is declared. */
    readonly siteUrl: string
    /** The public origin of the site (browsers are sent back to it), absent in a bare local setup. */
    readonly publicSiteUrl: string | undefined
    /** The public origin of the back end, where providers call webhooks and callbacks; the site origin when absent. */
    readonly publicApiUrl?: string
}
