import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetAgentProviderDefaultRequest } from "./set-agent-provider-default.contracts"

/** Makes an agent's attachment to an account its default account of that provider (the account a step's call uses when nothing else picks one). */
export class SetAgentProviderDefaultCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetAgentProviderDefaultRequest>) {
        super()
    }
}
