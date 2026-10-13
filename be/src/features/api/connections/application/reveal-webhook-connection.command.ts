import { Command } from "@nestjs/cqrs"
import type { WebhookView } from "@modules/domain/webhook-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RevealWebhookConnectionRequest } from "./reveal-webhook-connection.contracts"

/** Shows the signing secret and the events of a webhook connection again. */
export class RevealWebhookConnectionCommand extends Command<WebhookView> {
    constructor(readonly params: ExecuteParams<RevealWebhookConnectionRequest>) {
        super()
    }
}
