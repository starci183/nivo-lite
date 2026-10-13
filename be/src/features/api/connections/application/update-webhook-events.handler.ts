import { CommandHandler } from "@nestjs/cqrs"
import { WebhookConnectionsService } from "@modules/domain/webhook-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpdateWebhookEventsCommand } from "./update-webhook-events.command"

@CommandHandler(UpdateWebhookEventsCommand)
/** Changes which events a webhook connection receives through the WebhookConnectionsService. */
export class UpdateWebhookEventsHandler extends ICQRSHandler<UpdateWebhookEventsCommand, ReadonlyArray<string>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly webhooks: WebhookConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateWebhookEventsCommand): Promise<ReadonlyArray<string>> {
        return this.webhooks.updateEvents(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            command.params.request.events,
        )
    }
}
