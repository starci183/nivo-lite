import type { SmtpConfig } from "@modules/integrations/mail"

/** What the SMTP wizard form holds, as the owner typed it. */
export interface SmtpFormInput {
    /** The provider choice of the wizard: google_workspace, gmail, microsoft365, zoho, vn_hosting or relay_service. */
    readonly preset: string
    /** The mail server. */
    readonly host: string
    /** The mail port. */
    readonly port: number
    /** `tls` for an implicit TLS port, anything else is STARTTLS. */
    readonly security: string
    /** The login. */
    readonly user: string
    /** The password. */
    readonly password: string
    /** The display name of the sender. */
    readonly fromName: string
    /** The sender mailbox. */
    readonly fromEmail: string
    /** The Reply-To mailbox, or empty. */
    readonly replyTo: string
}

/** The SMTP form after cleaning: ready to store. */
export interface SmtpForm {
    /** The provider choice. */
    readonly preset: string
    /** The mail server, lower case. */
    readonly host: string
    /** The mail port. */
    readonly port: number
    /** The channel security. */
    readonly security: SmtpConfig["security"]
    /** The login. */
    readonly user: string
    /** The password, cleaned for the provider. */
    readonly password: string
    /** The display name of the sender. */
    readonly fromName: string
    /** The sender mailbox, lower case. */
    readonly fromEmail: string
    /** The Reply-To mailbox, lower case, or empty. */
    readonly replyTo: string
}

/** What starting an SMTP connection answers. */
export interface SmtpConnectionView {
    /** The connection id. */
    readonly id: string
    /** The mail server. */
    readonly host: string
    /** The sender mailbox. */
    readonly fromEmail: string
    /** Whether it is the workspace default sender. */
    readonly isDefault: boolean
}

/** What a test email answers. */
export interface SmtpTestResult {
    /** The address the test went to. */
    readonly to: string
    /** Whether the connection is now the workspace default sender. */
    readonly isDefault: boolean
}

/** What sending a test email takes. */
export interface SmtpTestInput {
    /** The SMTP connection. */
    readonly connectionId: string
    /** The address to send the test to. */
    readonly to: string
    /** Whether to make the connection the default sender. */
    readonly makeDefault: boolean
}
