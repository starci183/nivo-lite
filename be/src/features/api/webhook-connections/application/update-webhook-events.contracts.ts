/** What the UpdateWebhookEvents operation takes. */
export interface UpdateWebhookEventsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
    /** The events sent by the caller. */
    readonly events: string[]
}

/** What the UpdateWebhookEvents operation answers. */
export type UpdateWebhookEventsResult = ReadonlyArray<string>
