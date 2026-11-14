import { CommandHandler } from "@nestjs/cqrs"
import { ModuleInstallService, type InstallationView } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SetOperatingModeCommand } from "./set-operating-mode.command"

@CommandHandler(SetOperatingModeCommand)
/** The old operating-mode switch: the module install service answers a typed refusal (a node's declared mode alone decides). */
export class SetOperatingModeHandler extends ICQRSHandler<SetOperatingModeCommand, InstallationView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly installs: ModuleInstallService,
    ) {
        super(logger)
    }

    protected override process(command: SetOperatingModeCommand): Promise<InstallationView> {
        return this.installs.setOperatingMode(command.params.principal.id, command.params.request.workspaceId)
    }
}
