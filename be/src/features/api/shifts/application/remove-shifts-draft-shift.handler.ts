import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsScheduleService } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RemoveShiftsDraftShiftCommand } from "./remove-shifts-draft-shift.command"

@CommandHandler(RemoveShiftsDraftShiftCommand)
/** Remove a shift from a draft schedule. */
export class RemoveShiftsDraftShiftHandler extends ICQRSHandler<RemoveShiftsDraftShiftCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly schedule: ShiftsScheduleService,
    ) {
        super(logger)
    }

    protected override process(command: RemoveShiftsDraftShiftCommand): Promise<void> {
        return this.schedule.removeDraftShift(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
