import { CommandHandler } from "@nestjs/cqrs"
import { CsvImportWizardService } from "@modules/domain/data-hub"
import type { CsvImportResult } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RunCsvImportCommand } from "./run-csv-import.command"

@CommandHandler(RunCsvImportCommand)
/** Imports a table source through the CsvImportWizardService. */
export class RunCsvImportHandler extends ICQRSHandler<RunCsvImportCommand, CsvImportResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: CsvImportWizardService,
    ) {
        super(logger)
    }

    protected override process(command: RunCsvImportCommand): Promise<CsvImportResult> {
        return this.wizard.importTable(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request,
        )
    }
}
