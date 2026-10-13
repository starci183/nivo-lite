import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsScheduleService } from "@modules/domain/shifts"
import type { ReassignShiftOutput } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReassignShiftsShiftCommand } from "./reassign-shifts-shift.command"

@CommandHandler(ReassignShiftsShiftCommand)
/** Give a draft shift to another person or open it. */
export class ReassignShiftsShiftHandler extends ICQRSHandler<ReassignShiftsShiftCommand, ReassignShiftOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly schedule: ShiftsScheduleService,
    ) {
        super(logger)
    }

    protected override process(command: ReassignShiftsShiftCommand): Promise<ReassignShiftOutput> {
        return this.schedule.reassignShift(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
