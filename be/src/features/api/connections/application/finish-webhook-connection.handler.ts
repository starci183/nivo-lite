import { CommandHandler } from "@nestjs/cqrs"
import { WebhookConnectionsService } from "@modules/domain/webhook-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { FinishWebhookConnectionCommand } from "./finish-webhook-connection.command"

@CommandHandler(FinishWebhookConnectionCommand)
/** Marks a webhook connection live through the WebhookConnectionsService. */
export class FinishWebhookConnectionHandler extends ICQRSHandler<FinishWebhookConnectionCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly webhooks: WebhookConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: FinishWebhookConnectionCommand): Promise<void> {
        return this.webhooks.finish(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
        )
    }
}
