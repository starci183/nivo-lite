import type { WebhookView } from "@modules/domain/webhook-connections"

/** What the RevealWebhook operation takes. */
export interface RevealWebhookRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
}

/** What the RevealWebhook operation answers. */
export type RevealWebhookResult = WebhookView
