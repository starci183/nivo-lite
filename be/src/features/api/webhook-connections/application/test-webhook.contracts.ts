import type { WebhookTestResult } from "@modules/domain/webhook-connections"

/** What the TestWebhook operation takes. */
export interface TestWebhookRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
}

/** What the TestWebhook operation answers. */
export type TestWebhookResult = WebhookTestResult
