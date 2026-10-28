import { CommandHandler } from "@nestjs/cqrs"
import { SepayConnectionService } from "@modules/domain/channel-connections"
import type { SepayConnectionView } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetSepayEnvironmentCommand } from "./set-sepay-environment.command"

@CommandHandler(SetSepayEnvironmentCommand)
/** Switches a SePay connection between test and live through the SepayConnectionService. */
export class SetSepayEnvironmentHandler extends ICQRSHandler<SetSepayEnvironmentCommand, SepayConnectionView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sepay: SepayConnectionService,
    ) {
        super(logger)
    }

    protected override process(command: SetSepayEnvironmentCommand): Promise<SepayConnectionView> {
        return this.sepay.setEnvironment(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            command.params.request.environment,
        )
    }
}
