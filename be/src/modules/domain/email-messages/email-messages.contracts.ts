import type { SentMail } from "@modules/integrations/mail"

/** Who a message is for: the owner of the workspace or a customer. */
export type EmailAudience = "owner" | "customer"

/** Which sender carried (or would have carried) the message. */
export type EmailVia = "workspace" | "platform" | "none"

/** How a send attempt ended. */
export type SendEmailStatus = "sent" | "failed" | "no_smtp" | "blocked" | "rate_limited"

/** Why a send did not go out, in terms a caller can branch on. */
export type SendEmailFailure = "no_smtp" | "gate" | "rate" | "recipient" | "attachment" | "mail"

/** A file attached to an email, as a caller hands it over. */
export interface EmailAttachment {
    /** The file name; characters a mail client may misread are replaced. */
    readonly filename: string
    /** The content, as text or base64. */
    readonly content: string
    /** The media type, when known. */
    readonly contentType?: string | undefined
    /** How the content is encoded; utf8 by default. */
    readonly encoding?: "base64" | "utf8" | undefined
}

/** A sender to narrow a count to, or null for any. */
export type OptionalVia = EmailVia | null

/** What sending one email for a workspace takes. */
export interface SendEmailInput {
    /** The workspace. */
    readonly workspaceId: string
    /** A connection to send with; the default SMTP connection otherwise. */
    readonly connectionId?: string
    /** The recipient. */
    readonly to: string
    /** The subject. */
    readonly subject: string
    /** The HTML body. */
    readonly html: string
    /** The plain-text body. */
    readonly text: string
    /** What the email is for, a short key. */
    readonly purpose: string
    /** Records the email points at (invoice id, order id ...). */
    readonly refs?: Readonly<Record<string, unknown>>
    /** The audience; a customer by default. */
    readonly audience?: EmailAudience | undefined
    /** Customer-facing mail: the work item whose gate approved this send. */
    readonly workItemId?: string
    /** Files to attach: at most three, 2 MB together. */
    readonly attachments?: ReadonlyArray<EmailAttachment>
}

/** What a send answered. */
export interface SendEmailResult {
    /** How it ended. */
    readonly status: SendEmailStatus
    /** The id of the recorded attempt. */
    readonly emailMessageId: string | null
    /** The mail server's id of the message, when it was sent. */
    readonly messageId?: SentMail["messageId"] | undefined
    /** The sender used. */
    readonly via: EmailVia
    /** A sentence the owner can read, when it did not go out. */
    readonly error?: string | undefined
    /** Why it did not go out. */
    readonly failure?: SendEmailFailure | undefined
}

/** One send attempt to write down. */
export interface EmailRecord {
    /** The workspace. */
    readonly workspaceId: string
    /** The connection used, or null. */
    readonly connectionId: string | null
    /** The recipient. */
    readonly to: string
    /** The subject. */
    readonly subject: string
    /** What the email is for. */
    readonly purpose: string
    /** How it ended, or that it waits for the owner's decision. */
    readonly status: SendEmailStatus | "waiting_decision"
    /** The sender used. */
    readonly via: EmailVia
    /** The mail server's id of the message. */
    readonly providerMessageId: string | null
    /** The error text. */
    readonly error: string | null
    /** The records it points at. */
    readonly refs: Readonly<Record<string, unknown>>
}
