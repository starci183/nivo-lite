import { QueryHandler } from "@nestjs/cqrs"
import { WorkspaceDashboardService } from "@modules/domain/workspace-dashboard"
import type { WorkspaceDashboardData } from "@modules/domain/workspace-dashboard"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetWorkspaceDashboardQuery } from "./get-workspace-dashboard.query"

@QueryHandler(GetWorkspaceDashboardQuery)
/** Answers the workspace dashboard through the domain service, which proves the caller may read it. */
export class GetWorkspaceDashboardHandler extends ICQRSHandler<GetWorkspaceDashboardQuery, WorkspaceDashboardData> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly dashboard: WorkspaceDashboardService,
    ) {
        super(logger)
    }

    protected override process(query: GetWorkspaceDashboardQuery): Promise<WorkspaceDashboardData> {
        return this.dashboard.read(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.period,
        )
    }
}
