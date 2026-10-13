import { CommandHandler } from "@nestjs/cqrs"
import { WebhookConnectionsService } from "@modules/domain/webhook-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { WebhookTestResult } from "@modules/domain/webhook-connections"
import { TestWebhookConnectionCommand } from "./test-webhook-connection.command"

@CommandHandler(TestWebhookConnectionCommand)
/** Sends a signed sample event to a webhook connection through the WebhookConnectionsService. */
export class TestWebhookConnectionHandler extends ICQRSHandler<TestWebhookConnectionCommand, WebhookTestResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly webhooks: WebhookConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: TestWebhookConnectionCommand): Promise<WebhookTestResult> {
        return this.webhooks.test(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
        )
    }
}
