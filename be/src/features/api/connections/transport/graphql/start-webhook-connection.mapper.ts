import type { StartWebhookConnectionRequest } from "../../application/start-webhook-connection.contracts"
import type { CreatedWebhook } from "@modules/domain/webhook-connections"
import type { StartWebhookConnectionInput } from "./dto/start-webhook-connection.input"
import type { CreatedWebhookType } from "./dto/created-webhook.type"

/** Maps the GraphQL arguments of startWebhookConnection to the request. */
export const toStartWebhookConnectionRequest = (
    workspaceId: string,
    input: StartWebhookConnectionInput,
): StartWebhookConnectionRequest => ({
    workspaceId,
    name: input.name,
    url: input.url,
    events: input.events,
})

/** Maps the answer of startWebhookConnection to the GraphQL type. */
export const toStartWebhookConnectionType = (result: CreatedWebhook): CreatedWebhookType => result
