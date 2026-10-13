/** What startWebhookConnection takes. */
export interface StartWebhookConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The name. */
    readonly name: string
    /** The receiver address. */
    readonly url: string
    /** The picked events. */
    readonly events: ReadonlyArray<string>
}
