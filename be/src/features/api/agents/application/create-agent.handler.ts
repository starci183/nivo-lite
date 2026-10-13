import { CommandHandler } from "@nestjs/cqrs"
import { AgentsService } from "@modules/domain/agents"
import type { AgentSummary } from "@modules/domain/agents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateAgentCommand } from "./create-agent.command"

@CommandHandler(CreateAgentCommand)
/** Adds the agent through the agents service. */
export class CreateAgentHandler extends ICQRSHandler<CreateAgentCommand, AgentSummary> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly agents: AgentsService,
    ) {
        super(logger)
    }

    protected override process(command: CreateAgentCommand): Promise<AgentSummary> {
        return this.agents.create(command.params.principal.id, command.params.request)
    }
}
