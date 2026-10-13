import { Command } from "@nestjs/cqrs"
import type { WebhookView } from "@modules/domain/webhook-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { StartWebhookConnectionRequest } from "./start-webhook-connection.contracts"

/** Starts a webhook connection as pending. */
export class StartWebhookConnectionCommand extends Command<WebhookView> {
    constructor(readonly params: ExecuteParams<StartWebhookConnectionRequest>) {
        super()
    }
}
