import { Command } from "@nestjs/cqrs"
import type { ProviderTriggerState } from "@modules/domain/provider-triggers"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BindProviderTriggerDeciderRequest } from "./bind-provider-trigger-decider.contracts"

/** Binds the agent that decides on a connected account's trigger, or unbinds it. */
export class BindProviderTriggerDeciderCommand extends Command<ProviderTriggerState> {
    constructor(readonly params: ExecuteParams<BindProviderTriggerDeciderRequest>) {
        super()
    }
}
