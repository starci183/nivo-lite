import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ExtendSubscriptionRequest, ExtendSubscriptionResult } from "./extend-subscription.contracts"

/** Extends a workspace's subscription by a number of days. */
export class ExtendSubscriptionCommand extends Command<ExtendSubscriptionResult> {
    constructor(readonly params: ExecuteParams<ExtendSubscriptionRequest>) {
        super()
    }
}
