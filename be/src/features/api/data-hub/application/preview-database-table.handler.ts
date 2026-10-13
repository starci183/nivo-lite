import { QueryHandler } from "@nestjs/cqrs"
import { DatabaseWizardService } from "@modules/domain/data-hub"
import type { DatabasePreview } from "@modules/integrations/data-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PreviewDatabaseTableQuery } from "./preview-database-table.query"

@QueryHandler(PreviewDatabaseTableQuery)
/** Previews one mapped table through the DatabaseWizardService. */
export class PreviewDatabaseTableHandler extends ICQRSHandler<PreviewDatabaseTableQuery, DatabasePreview> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: DatabaseWizardService,
    ) {
        super(logger)
    }

    protected override process(query: PreviewDatabaseTableQuery): Promise<DatabasePreview> {
        return this.wizard.preview(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request,
        )
    }
}
