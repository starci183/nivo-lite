import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsScheduleService } from "@modules/domain/shifts"
import type { RequestOutput } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestShiftsPublishCommand } from "./request-shifts-publish.command"

@CommandHandler(RequestShiftsPublishCommand)
/** Put a draft schedule before the owner to publish. */
export class RequestShiftsPublishHandler extends ICQRSHandler<RequestShiftsPublishCommand, RequestOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly schedule: ShiftsScheduleService,
    ) {
        super(logger)
    }

    protected override process(command: RequestShiftsPublishCommand): Promise<RequestOutput> {
        return this.schedule.requestPublish(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
