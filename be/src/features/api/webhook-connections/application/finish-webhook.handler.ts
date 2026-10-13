import { CommandHandler } from "@nestjs/cqrs"
import { WebhookConnectionsService } from "@modules/domain/webhook-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { FinishWebhookCommand } from "./finish-webhook.command"
import type { FinishWebhookResult } from "./finish-webhook.contracts"

@CommandHandler(FinishWebhookCommand)
/** Marks a webhook connection live. */
export class FinishWebhookHandler extends ICQRSHandler<FinishWebhookCommand, FinishWebhookResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly webhookConnectionsService: WebhookConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: FinishWebhookCommand): Promise<FinishWebhookResult> {
        const { request } = command.params
        return this.webhookConnectionsService.finish(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
        )
    }
}
