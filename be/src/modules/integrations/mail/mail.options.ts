import type { MailOptions as MailSettings } from "@starci/mail"

/** The languages the app writes its mail in. */
export type MailLanguage = "vi" | "en"

/**
 * Outgoing mail parsed once at API boot: the settings of `@starci/mail` (the platform sender) and what the app's own mail needs
 * (the product name in the header, the language of a mail whose request names none, how long a confirmation or reset link lives,
 * whether a workspace may point its own SMTP account at a private address). The words and layout of each mail belong to the
 * domain that sends it.
 */
export interface MailOptions extends MailSettings {
    /** The origin of the web app: the links of a confirmation or reset mail open its pages. */
    readonly webOrigin: string
    /** The product name in the header of every mail. */
    readonly brandName: string
    /** The language of a mail whose request names none. */
    readonly defaultLanguage: MailLanguage
    /** How long a confirmation link lives, in seconds. */
    readonly confirmTtlSeconds: number
    /** How long a password reset link lives, in seconds. */
    readonly resetTtlSeconds: number
    /** True on a development site: a local mail catcher on a private address may receive a workspace's mail. */
    readonly allowPrivateHosts: boolean
    /** The patterns of the recipients the platform sender never mails (`MAIL_SUPPRESS`): an exact address, `*.domain` for the domain and its subdomains, or a bare domain. */
    readonly suppress: ReadonlyArray<string>
    /** The folder that keeps the held messages for a test run (`MAIL_OUTBOX_DIR`, development only), or null: nothing is kept. */
    readonly outboxDir: string | null
}
