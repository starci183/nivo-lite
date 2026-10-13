/** What startSmtpConnection takes. */
export interface StartSmtpConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The provider choice of the wizard. */
    readonly preset: string
    /** The mail server. */
    readonly host: string
    /** The mail port. */
    readonly port: number
    /** `tls` or `starttls`. */
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
