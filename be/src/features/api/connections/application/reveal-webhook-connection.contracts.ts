/** What revealWebhookConnection takes. */
export interface RevealWebhookConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
}
