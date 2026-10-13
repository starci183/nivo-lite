/** What setDefaultSmtp takes. */
export interface SetDefaultSmtpRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The SMTP connection. */
    readonly connectionId: string
}
