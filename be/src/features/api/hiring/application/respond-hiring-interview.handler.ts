import { CommandHandler } from "@nestjs/cqrs"
import { HiringInterviewsService } from "@modules/domain/hiring"
import type { RespondSlotOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RespondHiringInterviewCommand } from "./respond-hiring-interview.command"

@CommandHandler(RespondHiringInterviewCommand)
/** Pick an interview time from the candidate's link. */
export class RespondHiringInterviewHandler extends ICQRSHandler<RespondHiringInterviewCommand, RespondSlotOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly interviews: HiringInterviewsService,
    ) {
        super(logger)
    }

    protected override process(command: RespondHiringInterviewCommand): Promise<RespondSlotOutput> {
        return this.interviews.respond(command.params.request)
    }
}
