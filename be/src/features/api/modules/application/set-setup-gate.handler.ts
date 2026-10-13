import { CommandHandler } from "@nestjs/cqrs"
import { SetupChatService } from "@modules/domain/modules"
import type { SetupSessionRecord } from "@modules/domain/module-setup-sessions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetSetupGateCommand } from "./set-setup-gate.command"

@CommandHandler(SetSetupGateCommand)
/** Changes the gate through the setup chat service. */
export class SetSetupGateHandler extends ICQRSHandler<SetSetupGateCommand, SetupSessionRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: SetupChatService,
    ) {
        super(logger)
    }

    protected override process(command: SetSetupGateCommand): Promise<SetupSessionRecord> {
        return this.chat.setGate(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.setupSessionId,
            command.params.request.gateKey,
            command.params.request.action,
            command.params.request.evidence,
        )
    }
}
