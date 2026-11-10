import { CommandHandler } from "@nestjs/cqrs"
import { AgentInstanceCreationService } from "@modules/domain/agent-instances"
import type { CreatedAgent } from "@modules/domain/agent-instances"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateAgentInstallationCommand } from "./create-agent-installation.command"

@CommandHandler(CreateAgentInstallationCommand)
/** Creates the agent through the agent instance creation service. */
export class CreateAgentInstallationHandler extends ICQRSHandler<CreateAgentInstallationCommand, CreatedAgent> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly creation: AgentInstanceCreationService,
    ) {
        super(logger)
    }

    protected override process(command: CreateAgentInstallationCommand): Promise<CreatedAgent> {
        return this.creation.create(command.params.principal.id, command.params.request)
    }
}
