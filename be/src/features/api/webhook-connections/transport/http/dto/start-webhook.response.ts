/** The HTTP response of the StartWebhook operation. */
export class StartWebhookResponse {
    /** The id. */
    id!: string
    /** The name. */
    name!: string
    /** The host. */
    host!: string
    /** The events. */
    events!: string[]
    /** The signingSecret. */
    signingSecret!: string
}
