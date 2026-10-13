import { CommandHandler } from "@nestjs/cqrs"
import { CsvImportWizardService } from "@modules/domain/data-hub"
import type { CsvImportResult } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RunDocumentImportCommand } from "./run-document-import.command"

@CommandHandler(RunDocumentImportCommand)
/** Imports documents through the CsvImportWizardService. */
export class RunDocumentImportHandler extends ICQRSHandler<RunDocumentImportCommand, CsvImportResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: CsvImportWizardService,
    ) {
        super(logger)
    }

    protected override process(command: RunDocumentImportCommand): Promise<CsvImportResult> {
        return this.wizard.importDocuments(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request,
        )
    }
}
