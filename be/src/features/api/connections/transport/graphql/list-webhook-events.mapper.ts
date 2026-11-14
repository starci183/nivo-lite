import type { WebhookEventOption } from "@modules/domain/webhook-connections"
import type { ListWebhookEventsRequest } from "../../application/list-webhook-events.contracts"
import type { WebhookEventOptionType } from "./dto/webhook-event-option.type"

/** Maps the GraphQL arguments of webhookEvents to the request. */
export const toListWebhookEventsRequest = (workspaceId: string): ListWebhookEventsRequest => ({ workspaceId })

/** Maps the answer of webhookEvents to the GraphQL type. */
export const toListWebhookEventsType = (result: ReadonlyArray<WebhookEventOption>): Array<WebhookEventOptionType> =>
    result.map((option) => ({
        id: option.id,
        label: option.label,
        summary: option.summary,
    }))
