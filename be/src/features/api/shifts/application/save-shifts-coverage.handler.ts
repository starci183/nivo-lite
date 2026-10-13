import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsSetupService } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveShiftsCoverageCommand } from "./save-shifts-coverage.command"

@CommandHandler(SaveShiftsCoverageCommand)
/** Create or update one coverage block. */
export class SaveShiftsCoverageHandler extends ICQRSHandler<SaveShiftsCoverageCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: ShiftsSetupService,
    ) {
        super(logger)
    }

    protected override process(command: SaveShiftsCoverageCommand): Promise<void> {
        return this.setup.saveCoverage(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
