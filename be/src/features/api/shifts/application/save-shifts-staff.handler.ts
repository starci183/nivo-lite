import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsSetupService } from "@modules/domain/shifts"
import type { SaveStaffOutput } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveShiftsStaffCommand } from "./save-shifts-staff.command"

@CommandHandler(SaveShiftsStaffCommand)
/** Create or update one person's shifts profile. */
export class SaveShiftsStaffHandler extends ICQRSHandler<SaveShiftsStaffCommand, SaveStaffOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: ShiftsSetupService,
    ) {
        super(logger)
    }

    protected override process(command: SaveShiftsStaffCommand): Promise<SaveStaffOutput> {
        return this.setup.saveStaff(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
