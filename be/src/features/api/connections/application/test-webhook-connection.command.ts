import { Command } from "@nestjs/cqrs"
import type { WebhookTestResult } from "@modules/domain/webhook-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { TestWebhookConnectionRequest } from "./test-webhook-connection.contracts"

/** Sends a signed sample event to a webhook connection. */
export class TestWebhookConnectionCommand extends Command<WebhookTestResult> {
    constructor(readonly params: ExecuteParams<TestWebhookConnectionRequest>) {
        super()
    }
}
