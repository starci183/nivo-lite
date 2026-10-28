import { CommandHandler } from "@nestjs/cqrs"
import { WebhookConnectionsService } from "@modules/domain/webhook-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { CreatedWebhook } from "@modules/domain/webhook-connections"
import { StartWebhookConnectionCommand } from "./start-webhook-connection.command"

@CommandHandler(StartWebhookConnectionCommand)
/** Starts a webhook connection as pending through the WebhookConnectionsService. */
export class StartWebhookConnectionHandler extends ICQRSHandler<StartWebhookConnectionCommand, CreatedWebhook> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly webhooks: WebhookConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: StartWebhookConnectionCommand): Promise<CreatedWebhook> {
        return this.webhooks.start(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            {
                name: command.params.request.name,
                url: command.params.request.url,
                events: command.params.request.events,
            },
        )
    }
}
