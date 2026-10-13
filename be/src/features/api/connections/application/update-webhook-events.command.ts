import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdateWebhookEventsRequest } from "./update-webhook-events.contracts"

/** Changes which events a webhook connection receives. */
export class UpdateWebhookEventsCommand extends Command<ReadonlyArray<string>> {
    constructor(readonly params: ExecuteParams<UpdateWebhookEventsRequest>) {
        super()
    }
}
