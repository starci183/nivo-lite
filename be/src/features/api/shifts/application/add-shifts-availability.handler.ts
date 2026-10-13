import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsSetupService } from "@modules/domain/shifts"
import type { SaveShiftsAvailabilityOutput } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AddShiftsAvailabilityCommand } from "./add-shifts-availability.command"

@CommandHandler(AddShiftsAvailabilityCommand)
/** Add an availability statement for a person, approved at once. */
export class AddShiftsAvailabilityHandler extends ICQRSHandler<
    AddShiftsAvailabilityCommand,
    SaveShiftsAvailabilityOutput
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: ShiftsSetupService,
    ) {
        super(logger)
    }

    protected override process(command: AddShiftsAvailabilityCommand): Promise<SaveShiftsAvailabilityOutput> {
        return this.setup.addAvailability(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
