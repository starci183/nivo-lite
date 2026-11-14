import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AttachAgentProviderRequest } from "./attach-agent-provider.contracts"

/** Attaches an agent to a connected provider (an attachment is the agent and the connection: nothing is ticked). */
export class AttachAgentProviderCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<AttachAgentProviderRequest>) {
        super()
    }
}
