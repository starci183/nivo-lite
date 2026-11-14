import { QueryHandler } from "@nestjs/cqrs"
import { RecordTypesPageService, type RecordModuleView } from "@modules/domain/workbench-door"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RecordTypesQuery } from "./record-types.query"

@QueryHandler(RecordTypesQuery)
/** Reads the record types of the workspace's installed agents for a member, with the workbench reads and actions that reach them. */
export class RecordTypesHandler extends ICQRSHandler<RecordTypesQuery, ReadonlyArray<RecordModuleView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: RecordTypesPageService,
    ) {
        super(logger)
    }

    protected override process(query: RecordTypesQuery): Promise<ReadonlyArray<RecordModuleView>> {
        return this.page.list(query.params.principal.id, query.params.request.workspaceId)
    }
}
