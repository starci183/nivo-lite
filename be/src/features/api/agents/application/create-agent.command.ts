import { Command } from "@nestjs/cqrs"
import type { AgentSummary } from "@modules/domain/agents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateAgentRequest } from "./create-agent.contracts"

/** Asks to add an agent to the caller's workspace. */
export class CreateAgentCommand extends Command<AgentSummary> {
    constructor(readonly params: ExecuteParams<CreateAgentRequest>) {
        super()
    }
}
