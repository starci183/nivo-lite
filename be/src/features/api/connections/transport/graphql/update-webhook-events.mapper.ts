import type { UpdateWebhookEventsRequest } from "../../application/update-webhook-events.contracts"
import type { UpdateWebhookEventsInput } from "./dto/update-webhook-events.input"
import type { WebhookEventsType } from "./dto/webhook-events.type"

/** Maps the GraphQL arguments of updateWebhookEvents to the request. */
export const toUpdateWebhookEventsRequest = (
    workspaceId: string,
    input: UpdateWebhookEventsInput,
): UpdateWebhookEventsRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    events: input.events,
})

/** Maps the answer of updateWebhookEvents to the GraphQL type. */
export const toUpdateWebhookEventsType = (result: ReadonlyArray<string>): WebhookEventsType => ({ events: result })
