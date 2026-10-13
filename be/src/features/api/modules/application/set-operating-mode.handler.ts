import { CommandHandler } from "@nestjs/cqrs"
import { ModuleInstallService } from "@modules/domain/modules"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetOperatingModeCommand } from "./set-operating-mode.command"

@CommandHandler(SetOperatingModeCommand)
/** Sets the operating mode through the module install service. */
export class SetOperatingModeHandler extends ICQRSHandler<SetOperatingModeCommand, InstallationRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly installs: ModuleInstallService,
    ) {
        super(logger)
    }

    protected override process(command: SetOperatingModeCommand): Promise<InstallationRecord> {
        return this.installs.setOperatingMode(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.installationId,
            command.params.request.mode,
        )
    }
}
