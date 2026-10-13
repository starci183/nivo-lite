import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsSetupService } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideShiftsAvailabilityCommand } from "./decide-shifts-availability.command"

@CommandHandler(DecideShiftsAvailabilityCommand)
/** Approve or decline a pending availability statement. */
export class DecideShiftsAvailabilityHandler extends ICQRSHandler<DecideShiftsAvailabilityCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: ShiftsSetupService,
    ) {
        super(logger)
    }

    protected override process(command: DecideShiftsAvailabilityCommand): Promise<void> {
        return this.setup.decideAvailability(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
