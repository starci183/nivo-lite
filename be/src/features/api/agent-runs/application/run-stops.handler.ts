import { QueryHandler } from "@nestjs/cqrs"
import { RunStopsPageService, type RunStopsPage } from "@modules/domain/agent-pages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RunStopsQuery } from "./run-stops.query"

@QueryHandler(RunStopsQuery)
/** Reads one page of the open stops of the workspace for an owner or a manager (the guard of the door that decides them). */
export class RunStopsHandler extends ICQRSHandler<RunStopsQuery, RunStopsPage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: RunStopsPageService,
    ) {
        super(logger)
    }

    protected override process(query: RunStopsQuery): Promise<RunStopsPage> {
        return this.page.open(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.limit,
            query.params.request.cursor,
        )
    }
}
