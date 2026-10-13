import type { TestWebhookConnectionRequest } from "../../application/test-webhook-connection.contracts"
import type { WebhookTestResult } from "@modules/domain/webhook-connections"
import type { TestWebhookConnectionInput } from "./dto/test-webhook-connection.input"
import type { WebhookTestResultType } from "./dto/webhook-test-result.type"

/** Maps the GraphQL arguments of testWebhookConnection to the request. */
export const toTestWebhookConnectionRequest = (
    workspaceId: string,
    input: TestWebhookConnectionInput,
): TestWebhookConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of testWebhookConnection to the GraphQL type. */
export const toTestWebhookConnectionType = (result: WebhookTestResult): WebhookTestResultType => result
