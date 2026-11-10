import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DetachAgentProviderRequest } from "./detach-agent-provider.contracts"

/** Detaches an agent from a provider. */
export class DetachAgentProviderCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DetachAgentProviderRequest>) {
        super()
    }
}
