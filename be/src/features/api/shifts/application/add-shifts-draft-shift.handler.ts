import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsScheduleService } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AddShiftsDraftShiftCommand } from "./add-shifts-draft-shift.command"

@CommandHandler(AddShiftsDraftShiftCommand)
/** Add a shift to a draft schedule. */
export class AddShiftsDraftShiftHandler extends ICQRSHandler<AddShiftsDraftShiftCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly schedule: ShiftsScheduleService,
    ) {
        super(logger)
    }

    protected override process(command: AddShiftsDraftShiftCommand): Promise<void> {
        return this.schedule.addDraftShift(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
