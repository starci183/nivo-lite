/** What updateWebhookEvents takes. */
export interface UpdateWebhookEventsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** The picked events. */
    readonly events: ReadonlyArray<string>
}
