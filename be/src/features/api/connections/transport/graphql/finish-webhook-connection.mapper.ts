import type { FinishWebhookConnectionRequest } from "../../application/finish-webhook-connection.contracts"
import type { FinishWebhookConnectionInput } from "./dto/finish-webhook-connection.input"

/** Maps the GraphQL arguments of finishWebhookConnection to the request. */
export const toFinishWebhookConnectionRequest = (
    workspaceId: string,
    input: FinishWebhookConnectionInput,
): FinishWebhookConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})
