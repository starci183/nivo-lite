import type { WebhookView } from "@modules/domain/webhook-connections"

/** What the StartWebhook operation takes. */
export interface StartWebhookRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The name sent by the caller. */
    readonly name: string
    /** The url sent by the caller. */
    readonly url: string
    /** The events sent by the caller. */
    readonly events: string[]
}

/** What the StartWebhook operation answers. */
export type StartWebhookResult = WebhookView
