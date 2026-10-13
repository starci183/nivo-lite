import { QueryHandler } from "@nestjs/cqrs"
import { CsvImportWizardService } from "@modules/domain/data-hub"
import type { CsvSavedImport } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LoadCsvImportQuery } from "./load-csv-import.query"

@QueryHandler(LoadCsvImportQuery)
/** Reads the saved setup of one import through the CsvImportWizardService. */
export class LoadCsvImportHandler extends ICQRSHandler<LoadCsvImportQuery, CsvSavedImport> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: CsvImportWizardService,
    ) {
        super(logger)
    }

    protected override process(query: LoadCsvImportQuery): Promise<CsvSavedImport> {
        return this.wizard.load(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
