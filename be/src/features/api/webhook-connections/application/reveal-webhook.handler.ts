import { QueryHandler } from "@nestjs/cqrs"
import { WebhookConnectionsService } from "@modules/domain/webhook-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RevealWebhookQuery } from "./reveal-webhook.query"
import type { RevealWebhookResult } from "./reveal-webhook.contracts"

@QueryHandler(RevealWebhookQuery)
/** Shows the signing secret and the events of a webhook connection again. */
export class RevealWebhookHandler extends ICQRSHandler<RevealWebhookQuery, RevealWebhookResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly webhookConnectionsService: WebhookConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: RevealWebhookQuery): Promise<RevealWebhookResult> {
        const { request } = query.params
        return this.webhookConnectionsService.reveal(
            { principalId: query.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
        )
    }
}
