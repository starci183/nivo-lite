import { QueryHandler } from "@nestjs/cqrs"
import { WebhookConnectionsService, type WebhookEventOption } from "@modules/domain/webhook-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ListWebhookEventsQuery } from "./list-webhook-events.query"

@QueryHandler(ListWebhookEventsQuery)
/** Asks for the events a webhook receiver may pick through the WebhookConnectionsService. */
export class ListWebhookEventsHandler extends ICQRSHandler<ListWebhookEventsQuery, ReadonlyArray<WebhookEventOption>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly webhooks: WebhookConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: ListWebhookEventsQuery): Promise<ReadonlyArray<WebhookEventOption>> {
        return this.webhooks.availableEvents({
            principalId: query.params.principal.id,
            workspaceId: query.params.request.workspaceId,
        })
    }
}
