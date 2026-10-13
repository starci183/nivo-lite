import { CommandHandler } from "@nestjs/cqrs"
import { WebhookConnectionsService } from "@modules/domain/webhook-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { WebhookView } from "@modules/domain/webhook-connections"
import { RevealWebhookConnectionCommand } from "./reveal-webhook-connection.command"

@CommandHandler(RevealWebhookConnectionCommand)
/** Shows the signing secret and the events of a webhook connection again through the WebhookConnectionsService. */
export class RevealWebhookConnectionHandler extends ICQRSHandler<RevealWebhookConnectionCommand, WebhookView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly webhooks: WebhookConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: RevealWebhookConnectionCommand): Promise<WebhookView> {
        return this.webhooks.reveal(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
        )
    }
}
