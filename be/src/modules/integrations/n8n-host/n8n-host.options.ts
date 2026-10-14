import type { Secret } from "@modules/platform/config"

/** Where the n8n container runs and how the sync reaches it. */
export interface N8nHostOptions {
    /** The VPS host; undefined when none is configured. */
    readonly host: string | undefined
    /** The SSH user. */
    readonly user: string
    /** The SSH private key content; undefined when none is configured. */
    readonly sshKey: Secret | undefined
    /** The known-hosts content, or undefined to use the default. */
    readonly knownHosts: string | undefined
    /** The name of the n8n container. */
    readonly container: string
}
