import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { TestWebhookRequest, TestWebhookResult } from "./test-webhook.contracts"

/** Sends a signed sample event to a webhook connection. */
export class TestWebhookCommand extends Command<TestWebhookResult> {
    constructor(readonly params: ExecuteParams<TestWebhookRequest>) {
        super()
    }
}
