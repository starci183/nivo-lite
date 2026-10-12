import type { Secret } from "@modules/platform/config"

/** Connections configuration parsed once at API boot. */
export interface ConnectionsOptions {
    /** The AES-256-GCM key (32 bytes, base64) that seals every stored provider credential. */
    readonly channelTokenKey: Secret
    /** The public origin of the site (webhook and callback URLs are built from it), absent in a bare local setup. */
    readonly publicSiteUrl: string | undefined
}
