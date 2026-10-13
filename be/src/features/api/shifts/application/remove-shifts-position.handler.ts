import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsSetupService } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RemoveShiftsPositionCommand } from "./remove-shifts-position.command"

@CommandHandler(RemoveShiftsPositionCommand)
/** Retire a position. */
export class RemoveShiftsPositionHandler extends ICQRSHandler<RemoveShiftsPositionCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: ShiftsSetupService,
    ) {
        super(logger)
    }

    protected override process(command: RemoveShiftsPositionCommand): Promise<void> {
        return this.setup.removePosition(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
