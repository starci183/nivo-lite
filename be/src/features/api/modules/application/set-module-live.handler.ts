import { CommandHandler } from "@nestjs/cqrs"
import { AgentActivationService, type InstallationView } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SetModuleLiveCommand } from "./set-module-live.command"

@CommandHandler(SetModuleLiveCommand)
/** Switches the agent through the activation service, which keeps a channel to one agent of a role when a paused agent resumes. */
export class SetModuleLiveHandler extends ICQRSHandler<SetModuleLiveCommand, InstallationView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly activation: AgentActivationService,
    ) {
        super(logger)
    }

    protected override process(command: SetModuleLiveCommand): Promise<InstallationView> {
        return this.activation.setInstallationLive(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.installationId,
            command.params.request.live,
            command.params.request.keep,
        )
    }
}
