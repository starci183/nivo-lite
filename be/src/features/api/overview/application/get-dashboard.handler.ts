import { QueryHandler } from "@nestjs/cqrs"
import { OverviewService } from "@modules/domain/overview"
import type { OverviewSnapshot } from "@modules/domain/overview"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetDashboardQuery } from "./get-dashboard.query"

@QueryHandler(GetDashboardQuery)
/** Answers the dashboard of the workspace from the overview service. */
export class GetDashboardHandler extends ICQRSHandler<GetDashboardQuery, OverviewSnapshot> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly overview: OverviewService,
    ) {
        super(logger)
    }

    protected override process(query: GetDashboardQuery): Promise<OverviewSnapshot> {
        return this.overview.dashboard(query.params.principal.id, query.params.request.workspaceId)
    }
}
