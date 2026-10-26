import { CommandHandler } from "@nestjs/cqrs"
import { AgentRemovalService } from "@modules/domain/modules"
import type { InstallationView } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RemoveAgentCommand } from "./remove-agent.command"

@CommandHandler(RemoveAgentCommand)
/** Removes the agent through the removal service. */
export class RemoveAgentHandler extends ICQRSHandler<RemoveAgentCommand, InstallationView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly removal: AgentRemovalService,
    ) {
        super(logger)
    }

    protected override process(command: RemoveAgentCommand): Promise<InstallationView> {
        return this.removal.remove(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.installationId,
        )
    }
}
