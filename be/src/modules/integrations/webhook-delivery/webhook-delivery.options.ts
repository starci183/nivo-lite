/** Options of the webhook-delivery integration. */
export interface WebhookDeliveryOptions {
    /** How long one delivery waits for the receiver, in milliseconds. */
    readonly timeoutMs: number
}
