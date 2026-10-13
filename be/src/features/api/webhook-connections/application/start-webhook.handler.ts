import { CommandHandler } from "@nestjs/cqrs"
import { WebhookConnectionsService } from "@modules/domain/webhook-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StartWebhookCommand } from "./start-webhook.command"
import type { StartWebhookResult } from "./start-webhook.contracts"

@CommandHandler(StartWebhookCommand)
/** Starts an outgoing webhook connection. */
export class StartWebhookHandler extends ICQRSHandler<StartWebhookCommand, StartWebhookResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly webhookConnectionsService: WebhookConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: StartWebhookCommand): Promise<StartWebhookResult> {
        const { request } = command.params
        return this.webhookConnectionsService.start(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            { name: request.name, url: request.url, events: request.events },
        )
    }
}
