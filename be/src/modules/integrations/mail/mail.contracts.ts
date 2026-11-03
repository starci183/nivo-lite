import type { MailMessage } from "@starci/mail"

/** How a workspace SMTP connection secures the channel. */
export type SmtpSecurity = "starttls" | "tls"

/** What a workspace SMTP connection needs to send; the password comes from the connection secret, decrypted by the caller. */
export interface SmtpConfig {
    /** The mail server. */
    readonly host: string
    /** The mail port. */
    readonly port: number
    /** `tls` for an implicit TLS port, `starttls` otherwise. */
    readonly security: SmtpSecurity
    /** The login. */
    readonly user: string
    /** The password. */
    readonly pass: string
    /** The display name of the sender. */
    readonly fromName: string
    /** The sender mailbox. */
    readonly fromEmail: string
    /** The Reply-To mailbox, when different. */
    readonly replyTo?: string | undefined
}

/** One message and the mailbox it goes to. */
export interface MailDelivery {
    /** The recipient. */
    readonly to: string
    /** The subject, the bodies and at most three attachments. */
    readonly message: MailMessage
}

/** A message rendered by the shop layout. */
export interface RenderedEmail {
    /** The HTML part. */
    readonly html: string
    /** The text part. */
    readonly text: string
}

/** What the shop layout wraps around an already rendered plain body. */
export interface EmailLayoutInput {
    /** The shop name shown in the header. */
    readonly shopName: string
    /** A #rrggbb accent colour; anything else falls back to the default. */
    readonly accent?: string
    /** The title line of the email. */
    readonly title: string
    /** The plain body: a blank line starts a paragraph, lines starting with "- " form a list. */
    readonly body: string
    /** The footer line. */
    readonly footer: string
    /** The language of the email (the html lang attribute). */
    readonly lang: string
}
