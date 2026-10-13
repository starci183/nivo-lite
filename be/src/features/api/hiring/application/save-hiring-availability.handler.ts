import { CommandHandler } from "@nestjs/cqrs"
import { HiringInterviewsService } from "@modules/domain/hiring"
import type { SaveAvailabilityOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveHiringAvailabilityCommand } from "./save-hiring-availability.command"

@CommandHandler(SaveHiringAvailabilityCommand)
/** Replace the weekly free times of a member. */
export class SaveHiringAvailabilityHandler extends ICQRSHandler<SaveHiringAvailabilityCommand, SaveAvailabilityOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly interviews: HiringInterviewsService,
    ) {
        super(logger)
    }

    protected override process(command: SaveHiringAvailabilityCommand): Promise<SaveAvailabilityOutput> {
        return this.interviews.saveAvailability(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
