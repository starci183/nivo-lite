import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsSetupService } from "@modules/domain/shifts"
import type { SaveShiftsAvailabilityOutput } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SubmitShiftsAvailabilityCommand } from "./submit-shifts-availability.command"

@CommandHandler(SubmitShiftsAvailabilityCommand)
/** File the caller's own availability statement, waiting for approval. */
export class SubmitShiftsAvailabilityHandler extends ICQRSHandler<
    SubmitShiftsAvailabilityCommand,
    SaveShiftsAvailabilityOutput
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: ShiftsSetupService,
    ) {
        super(logger)
    }

    protected override process(command: SubmitShiftsAvailabilityCommand): Promise<SaveShiftsAvailabilityOutput> {
        return this.setup.submitAvailability(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
