import { CommandHandler } from "@nestjs/cqrs"
import { ModuleInstallService } from "@modules/domain/modules"
import type { InstallationView } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RenameInstallationAgentCommand } from "./rename-installation-agent.command"

@CommandHandler(RenameInstallationAgentCommand)
/** Renames the agent through the module install service. */
export class RenameInstallationAgentHandler extends ICQRSHandler<RenameInstallationAgentCommand, InstallationView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly installs: ModuleInstallService,
    ) {
        super(logger)
    }

    protected override process(command: RenameInstallationAgentCommand): Promise<InstallationView> {
        return this.installs.renameAgent(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.installationId,
            command.params.request.name,
        )
    }
}
