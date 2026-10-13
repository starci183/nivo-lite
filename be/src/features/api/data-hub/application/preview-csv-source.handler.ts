import { QueryHandler } from "@nestjs/cqrs"
import { CsvImportWizardService } from "@modules/domain/data-hub"
import type { CsvPreview } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PreviewCsvSourceQuery } from "./preview-csv-source.query"

@QueryHandler(PreviewCsvSourceQuery)
/** Previews an import source through the CsvImportWizardService. */
export class PreviewCsvSourceHandler extends ICQRSHandler<PreviewCsvSourceQuery, CsvPreview> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: CsvImportWizardService,
    ) {
        super(logger)
    }

    protected override process(query: PreviewCsvSourceQuery): Promise<CsvPreview> {
        return this.wizard.preview(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request,
        )
    }
}
