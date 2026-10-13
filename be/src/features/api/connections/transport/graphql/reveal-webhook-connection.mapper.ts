import type { RevealWebhookConnectionRequest } from "../../application/reveal-webhook-connection.contracts"
import type { WebhookView } from "@modules/domain/webhook-connections"
import type { RevealWebhookConnectionInput } from "./dto/reveal-webhook-connection.input"
import type { WebhookViewType } from "./dto/webhook-view.type"

/** Maps the GraphQL arguments of revealWebhookConnection to the request. */
export const toRevealWebhookConnectionRequest = (
    workspaceId: string,
    input: RevealWebhookConnectionInput,
): RevealWebhookConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of revealWebhookConnection to the GraphQL type. */
export const toRevealWebhookConnectionType = (result: WebhookView): WebhookViewType => result
