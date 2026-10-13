import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { StartWebhookRequest, StartWebhookResult } from "./start-webhook.contracts"

/** Starts an outgoing webhook connection. */
export class StartWebhookCommand extends Command<StartWebhookResult> {
    constructor(readonly params: ExecuteParams<StartWebhookRequest>) {
        super()
    }
}
