import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsRequestsService } from "@modules/domain/shifts"
import type { RequestOutput } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestShiftsLeaveCommand } from "./request-shifts-leave.command"

@CommandHandler(RequestShiftsLeaveCommand)
/** Ask for leave. */
export class RequestShiftsLeaveHandler extends ICQRSHandler<RequestShiftsLeaveCommand, RequestOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly requests: ShiftsRequestsService,
    ) {
        super(logger)
    }

    protected override process(command: RequestShiftsLeaveCommand): Promise<RequestOutput> {
        return this.requests.requestLeave(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
