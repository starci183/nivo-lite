import { CommandHandler } from "@nestjs/cqrs"
import { WebhookConnectionsService } from "@modules/domain/webhook-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpdateWebhookEventsCommand } from "./update-webhook-events.command"
import type { UpdateWebhookEventsResult } from "./update-webhook-events.contracts"

@CommandHandler(UpdateWebhookEventsCommand)
/** Changes which events a webhook connection receives. */
export class UpdateWebhookEventsHandler extends ICQRSHandler<UpdateWebhookEventsCommand, UpdateWebhookEventsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly webhookConnectionsService: WebhookConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateWebhookEventsCommand): Promise<UpdateWebhookEventsResult> {
        const { request } = command.params
        return this.webhookConnectionsService.updateEvents(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
            request.events,
        )
    }
}
