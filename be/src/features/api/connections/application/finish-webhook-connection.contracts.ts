/** What finishWebhookConnection takes. */
export interface FinishWebhookConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
}
