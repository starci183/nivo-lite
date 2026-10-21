import { CommandHandler } from "@nestjs/cqrs"
import { ModuleInstallService } from "@modules/domain/modules"
import type { InstallationView } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveInstallationSettingCommand } from "./save-installation-setting.command"

@CommandHandler(SaveInstallationSettingCommand)
/** Saves the setting through the module install service. */
export class SaveInstallationSettingHandler extends ICQRSHandler<SaveInstallationSettingCommand, InstallationView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly installs: ModuleInstallService,
    ) {
        super(logger)
    }

    protected override process(command: SaveInstallationSettingCommand): Promise<InstallationView> {
        return this.installs.saveSetting(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.installationId,
            command.params.request.name,
            command.params.request.value,
        )
    }
}
