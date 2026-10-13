import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsImportService } from "@modules/domain/shifts"
import type { ApplyImportOutput } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApplyShiftsImportCommand } from "./apply-shifts-import.command"

@CommandHandler(ApplyShiftsImportCommand)
/** Read the quick import text and set the shop up from it. */
export class ApplyShiftsImportHandler extends ICQRSHandler<ApplyShiftsImportCommand, ApplyImportOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly imports: ShiftsImportService,
    ) {
        super(logger)
    }

    protected override process(command: ApplyShiftsImportCommand): Promise<ApplyImportOutput> {
        return this.imports.applyImport(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
