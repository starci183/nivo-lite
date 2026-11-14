import { CommandHandler } from "@nestjs/cqrs"
import { ModuleInstallDoorService } from "@modules/domain/agent-pages"
import type { InstallResult } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { InstallModuleCommand } from "./install-module.command"

@CommandHandler(InstallModuleCommand)
/** Installs the module, then gives its agent the workflows its plugin ships: both through the capability. */
export class InstallModuleHandler extends ICQRSHandler<InstallModuleCommand, InstallResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly installs: ModuleInstallDoorService,
    ) {
        super(logger)
    }

    protected override process(command: InstallModuleCommand): Promise<InstallResult> {
        return this.installs.install(command.params.principal.id, command.params.request)
    }
}
