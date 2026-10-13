/** What sendSmtpTest takes. */
export interface SendSmtpTestRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The SMTP connection. */
    readonly connectionId: string
    /** The address to send the test to. */
    readonly to: string
    /** Whether to make it the default sender. */
    readonly makeDefault: boolean
}
