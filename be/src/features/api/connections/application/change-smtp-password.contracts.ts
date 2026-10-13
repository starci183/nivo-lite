/** What changeSmtpPassword takes. */
export interface ChangeSmtpPasswordRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The SMTP connection. */
    readonly connectionId: string
    /** The new password. */
    readonly password: string
}
