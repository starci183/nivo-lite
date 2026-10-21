import { CommandHandler } from "@nestjs/cqrs"
import { ModuleInstallService } from "@modules/domain/modules"
import type { InstallationView } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetModuleLiveCommand } from "./set-module-live.command"

@CommandHandler(SetModuleLiveCommand)
/** Switches the agent through the module install service. */
export class SetModuleLiveHandler extends ICQRSHandler<SetModuleLiveCommand, InstallationView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly installs: ModuleInstallService,
    ) {
        super(logger)
    }

    protected override process(command: SetModuleLiveCommand): Promise<InstallationView> {
        return this.installs.setLive(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.installationId,
            command.params.request.live,
        )
    }
}
