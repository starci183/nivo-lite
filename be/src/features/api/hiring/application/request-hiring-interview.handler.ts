import { CommandHandler } from "@nestjs/cqrs"
import { HiringInterviewsService } from "@modules/domain/hiring"
import type { RequestInterviewOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestHiringInterviewCommand } from "./request-hiring-interview.command"

@CommandHandler(RequestHiringInterviewCommand)
/** Arrange an interview for a candidate. */
export class RequestHiringInterviewHandler extends ICQRSHandler<RequestHiringInterviewCommand, RequestInterviewOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly interviews: HiringInterviewsService,
    ) {
        super(logger)
    }

    protected override process(command: RequestHiringInterviewCommand): Promise<RequestInterviewOutput> {
        return this.interviews.request(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
