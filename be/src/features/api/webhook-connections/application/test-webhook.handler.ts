import { CommandHandler } from "@nestjs/cqrs"
import { WebhookConnectionsService } from "@modules/domain/webhook-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TestWebhookCommand } from "./test-webhook.command"
import type { TestWebhookResult } from "./test-webhook.contracts"

@CommandHandler(TestWebhookCommand)
/** Sends a signed sample event to a webhook connection. */
export class TestWebhookHandler extends ICQRSHandler<TestWebhookCommand, TestWebhookResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly webhookConnectionsService: WebhookConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: TestWebhookCommand): Promise<TestWebhookResult> {
        const { request } = command.params
        return this.webhookConnectionsService.test(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
        )
    }
}
