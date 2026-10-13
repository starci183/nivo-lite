import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsScheduleService } from "@modules/domain/shifts"
import type { ExplainScheduleOutput } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ExplainShiftsScheduleCommand } from "./explain-shifts-schedule.command"

@CommandHandler(ExplainShiftsScheduleCommand)
/** Write the explanation of a schedule again. */
export class ExplainShiftsScheduleHandler extends ICQRSHandler<ExplainShiftsScheduleCommand, ExplainScheduleOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly schedule: ShiftsScheduleService,
    ) {
        super(logger)
    }

    protected override process(command: ExplainShiftsScheduleCommand): Promise<ExplainScheduleOutput> {
        return this.schedule.explainSchedule(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
