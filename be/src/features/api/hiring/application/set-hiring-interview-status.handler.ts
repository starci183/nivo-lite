import { CommandHandler } from "@nestjs/cqrs"
import { HiringInterviewsService } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetHiringInterviewStatusCommand } from "./set-hiring-interview-status.command"

@CommandHandler(SetHiringInterviewStatusCommand)
/** Mark an interview done, cancelled or missed. */
export class SetHiringInterviewStatusHandler extends ICQRSHandler<SetHiringInterviewStatusCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly interviews: HiringInterviewsService,
    ) {
        super(logger)
    }

    protected override process(command: SetHiringInterviewStatusCommand): Promise<void> {
        return this.interviews.setStatus(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
