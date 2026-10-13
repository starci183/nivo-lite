import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsScheduleService } from "@modules/domain/shifts"
import type { ProposeWeekOutput } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ProposeShiftsWeekCommand } from "./propose-shifts-week.command"

@CommandHandler(ProposeShiftsWeekCommand)
/** Build a draft schedule for the week that contains a day. */
export class ProposeShiftsWeekHandler extends ICQRSHandler<ProposeShiftsWeekCommand, ProposeWeekOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly schedule: ShiftsScheduleService,
    ) {
        super(logger)
    }

    protected override process(command: ProposeShiftsWeekCommand): Promise<ProposeWeekOutput> {
        return this.schedule.proposeWeek(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
