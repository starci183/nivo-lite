import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsSetupService } from "@modules/domain/shifts"
import type { SavePositionOutput } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveShiftsPositionCommand } from "./save-shifts-position.command"

@CommandHandler(SaveShiftsPositionCommand)
/** Create or update one position. */
export class SaveShiftsPositionHandler extends ICQRSHandler<SaveShiftsPositionCommand, SavePositionOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: ShiftsSetupService,
    ) {
        super(logger)
    }

    protected override process(command: SaveShiftsPositionCommand): Promise<SavePositionOutput> {
        return this.setup.savePosition(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
