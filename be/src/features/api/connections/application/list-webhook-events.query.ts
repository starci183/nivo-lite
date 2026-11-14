import { Query } from "@nestjs/cqrs"
import type { WebhookEventOption } from "@modules/domain/webhook-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListWebhookEventsRequest } from "./list-webhook-events.contracts"

/** Asks for the outgoing events a webhook receiver may pick: the ones the installed plugins declare and the engine's own. */
export class ListWebhookEventsQuery extends Query<ReadonlyArray<WebhookEventOption>> {
    constructor(readonly params: ExecuteParams<ListWebhookEventsRequest>) {
        super()
    }
}
