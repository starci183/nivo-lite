import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsSetupService } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RemoveShiftsAvailabilityCommand } from "./remove-shifts-availability.command"

@CommandHandler(RemoveShiftsAvailabilityCommand)
/** Remove an availability statement. */
export class RemoveShiftsAvailabilityHandler extends ICQRSHandler<RemoveShiftsAvailabilityCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: ShiftsSetupService,
    ) {
        super(logger)
    }

    protected override process(command: RemoveShiftsAvailabilityCommand): Promise<void> {
        return this.setup.removeAvailability(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
