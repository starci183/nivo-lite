import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { FinishWebhookRequest, FinishWebhookResult } from "./finish-webhook.contracts"

/** Marks a webhook connection live. */
export class FinishWebhookCommand extends Command<FinishWebhookResult> {
    constructor(readonly params: ExecuteParams<FinishWebhookRequest>) {
        super()
    }
}
