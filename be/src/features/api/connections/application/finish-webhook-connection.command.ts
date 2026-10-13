import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { FinishWebhookConnectionRequest } from "./finish-webhook-connection.contracts"

/** Marks a webhook connection live. */
export class FinishWebhookConnectionCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<FinishWebhookConnectionRequest>) {
        super()
    }
}
