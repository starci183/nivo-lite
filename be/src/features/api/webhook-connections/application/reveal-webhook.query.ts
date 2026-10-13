import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RevealWebhookRequest, RevealWebhookResult } from "./reveal-webhook.contracts"

/** Shows the signing secret and the events of a webhook connection again. */
export class RevealWebhookQuery extends Query<RevealWebhookResult> {
    constructor(readonly params: ExecuteParams<RevealWebhookRequest>) {
        super()
    }
}
