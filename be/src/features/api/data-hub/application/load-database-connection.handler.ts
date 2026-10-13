import { QueryHandler } from "@nestjs/cqrs"
import { DatabaseWizardService } from "@modules/domain/data-hub"
import type { SavedDatabase } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LoadDatabaseConnectionQuery } from "./load-database-connection.query"

@QueryHandler(LoadDatabaseConnectionQuery)
/** Reopens a saved database connection through the DatabaseWizardService. */
export class LoadDatabaseConnectionHandler extends ICQRSHandler<LoadDatabaseConnectionQuery, SavedDatabase> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: DatabaseWizardService,
    ) {
        super(logger)
    }

    protected override process(query: LoadDatabaseConnectionQuery): Promise<SavedDatabase> {
        return this.wizard.load(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
