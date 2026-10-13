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
    readonly replyTo?: string
}

/** One attachment of a message. */
export interface MailAttachment {
    /** The file name. */
    readonly filename: string
    /** The bytes. */
    readonly content: Buffer
    /** The media type, when known. */
    readonly contentType?: string
}

/** One message to send. */
export interface MailMessage {
    /** The recipient. */
    readonly to: string
    /** The subject, one line. */
    readonly subject: string
    /** The HTML body. */
    readonly html: string
    /** The plain-text body. */
    readonly text: string
    /** Attachments, at most three. */
    readonly attachments?: ReadonlyArray<MailAttachment>
}

/** What the mail server answered for an accepted message. */
export interface SentMail {
    /** The message id the server assigned. */
    readonly messageId: string
}

/** A message rendered by the shop layout. */
export interface RenderedEmail {
    /** The HTML part. */
    readonly html: string
    /** The text part. */
    readonly text: string
}
