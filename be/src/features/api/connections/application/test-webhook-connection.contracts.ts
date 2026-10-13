/** What testWebhookConnection takes. */
export interface TestWebhookConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
}
