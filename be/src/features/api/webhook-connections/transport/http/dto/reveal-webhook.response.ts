/** The HTTP response of the RevealWebhook operation. */
export class RevealWebhookResponse {
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
