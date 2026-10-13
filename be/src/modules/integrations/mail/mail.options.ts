import type { Secret } from "@modules/platform/config"

/** The platform's own sender, for owner-facing notices only. */
export interface PlatformSenderOptions {
    /** The SMTP URL of the platform mailbox, with its credentials. */
    readonly url: Secret
    /** The From header of a platform notice. */
    readonly from: string
}

/** Options of the mail integration. */
export interface MailOptions {
    /** True on a development site: a local mail catcher on a private address may receive mail. */
    readonly allowPrivateHosts: boolean
    /** The platform sender, or null when the deployment has none. */
    readonly platform: PlatformSenderOptions | null
    /** The name this server introduces itself with to a mail server. */
    readonly helloName: string
}
