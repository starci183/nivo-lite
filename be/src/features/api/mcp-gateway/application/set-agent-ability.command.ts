import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetAgentAbilityRequest } from "./set-agent-ability.contracts"

/** Ticks or unticks one ability of an agent on a provider it is attached to. */
export class SetAgentAbilityCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetAgentAbilityRequest>) {
        super()
    }
}
