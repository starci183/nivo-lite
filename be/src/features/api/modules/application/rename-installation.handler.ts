import { CommandHandler } from "@nestjs/cqrs"
import { ModuleInstallService } from "@modules/domain/modules"
import type { InstallationView } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RenameInstallationCommand } from "./rename-installation.command"

@CommandHandler(RenameInstallationCommand)
/** Renames the instance through the module install service. */
export class RenameInstallationHandler extends ICQRSHandler<RenameInstallationCommand, InstallationView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly installs: ModuleInstallService,
    ) {
        super(logger)
    }

    protected override process(command: RenameInstallationCommand): Promise<InstallationView> {
        return this.installs.rename(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.installationId,
            command.params.request.name,
        )
    }
}
