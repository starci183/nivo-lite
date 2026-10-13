import { QueryHandler } from "@nestjs/cqrs"
import { DataSyncService } from "@modules/domain/data-hub"
import type { DataSyncRun } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DataSyncRunQuery } from "./data-sync-run.query"

@QueryHandler(DataSyncRunQuery)
/** Asks how one sync run is going through the DataSyncService. */
export class DataSyncRunHandler extends ICQRSHandler<DataSyncRunQuery, DataSyncRun> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sync: DataSyncService,
    ) {
        super(logger)
    }

    protected override process(query: DataSyncRunQuery): Promise<DataSyncRun> {
        return this.sync.status(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.runId,
        )
    }
}
