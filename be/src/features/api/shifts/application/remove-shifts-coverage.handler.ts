import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsSetupService } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RemoveShiftsCoverageCommand } from "./remove-shifts-coverage.command"

@CommandHandler(RemoveShiftsCoverageCommand)
/** Remove a coverage block. */
export class RemoveShiftsCoverageHandler extends ICQRSHandler<RemoveShiftsCoverageCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: ShiftsSetupService,
    ) {
        super(logger)
    }

    protected override process(command: RemoveShiftsCoverageCommand): Promise<void> {
        return this.setup.removeCoverage(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
