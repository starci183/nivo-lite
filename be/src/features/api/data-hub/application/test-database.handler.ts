import { QueryHandler } from "@nestjs/cqrs"
import { DatabaseWizardService } from "@modules/domain/data-hub"
import type { DatabaseTable } from "@modules/integrations/data-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TestDatabaseQuery } from "./test-database.query"

@QueryHandler(TestDatabaseQuery)
/** Tests the connection to the owner database through the DatabaseWizardService. */
export class TestDatabaseHandler extends ICQRSHandler<TestDatabaseQuery, ReadonlyArray<DatabaseTable>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: DatabaseWizardService,
    ) {
        super(logger)
    }

    protected override process(query: TestDatabaseQuery): Promise<ReadonlyArray<DatabaseTable>> {
        return this.wizard.test(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request,
        )
    }
}
