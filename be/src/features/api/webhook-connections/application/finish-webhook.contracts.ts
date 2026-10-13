/** What the FinishWebhook operation takes. */
export interface FinishWebhookRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
}

/** What the FinishWebhook operation answers. */
export type FinishWebhookResult = void
