import { Command } from "@nestjs/cqrs"
import type { ProviderTriggerState } from "@modules/domain/provider-triggers"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetProviderTriggerEnabledRequest } from "./set-provider-trigger-enabled.contracts"

/** Turns the trigger of a connected account on or off. */
export class SetProviderTriggerEnabledCommand extends Command<ProviderTriggerState> {
    constructor(readonly params: ExecuteParams<SetProviderTriggerEnabledRequest>) {
        super()
    }
}
