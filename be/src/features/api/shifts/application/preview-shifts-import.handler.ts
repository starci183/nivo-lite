import { QueryHandler } from "@nestjs/cqrs"
import { ShiftsImportService } from "@modules/domain/shifts"
import type { PreviewImportOutput } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PreviewShiftsImportQuery } from "./preview-shifts-import.query"

@QueryHandler(PreviewShiftsImportQuery)
/** Read the quick import text and report what it would add. */
export class PreviewShiftsImportHandler extends ICQRSHandler<PreviewShiftsImportQuery, PreviewImportOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly imports: ShiftsImportService,
    ) {
        super(logger)
    }

    protected override process(query: PreviewShiftsImportQuery): Promise<PreviewImportOutput> {
        return this.imports.previewImport(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request,
        )
    }
}
