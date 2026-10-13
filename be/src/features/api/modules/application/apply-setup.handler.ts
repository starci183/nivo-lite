import { CommandHandler } from "@nestjs/cqrs"
import { SetupChatService } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApplySetupCommand } from "./apply-setup.command"

@CommandHandler(ApplySetupCommand)
/** Applies the draft through the setup chat service. */
export class ApplySetupHandler extends ICQRSHandler<ApplySetupCommand, number> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: SetupChatService,
    ) {
        super(logger)
    }

    protected override process(command: ApplySetupCommand): Promise<number> {
        return this.chat.apply(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.installationId,
            command.params.request.locale,
        )
    }
}
