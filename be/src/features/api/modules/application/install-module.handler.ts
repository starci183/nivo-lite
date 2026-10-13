import { CommandHandler } from "@nestjs/cqrs"
import { ModuleInstallService } from "@modules/domain/modules"
import type { InstallResult } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InstallModuleCommand } from "./install-module.command"

@CommandHandler(InstallModuleCommand)
/** Installs the module through the module install service. */
export class InstallModuleHandler extends ICQRSHandler<InstallModuleCommand, InstallResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly installs: ModuleInstallService,
    ) {
        super(logger)
    }

    protected override process(command: InstallModuleCommand): Promise<InstallResult> {
        return this.installs.install(command.params.principal.id, command.params.request)
    }
}
