import { QueryHandler } from "@nestjs/cqrs"
import { HiringWorkbenchService, type HiringBenchView } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { HiringWorkbenchQuery } from "./hiring-workbench.query"

@QueryHandler(HiringWorkbenchQuery)
/** The whole hiring workbench of the caller's workspace. */
export class HiringWorkbenchHandler extends ICQRSHandler<HiringWorkbenchQuery, HiringBenchView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly workbench: HiringWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(query: HiringWorkbenchQuery): Promise<HiringBenchView> {
        return this.workbench.bench(query.params.principal.id, query.params.request.workspaceId)
    }
}
