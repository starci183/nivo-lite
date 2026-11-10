import { Query } from "@nestjs/cqrs"
import type { WorkspaceDashboardData } from "@modules/domain/workspace-dashboard"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetWorkspaceDashboardRequest } from "./get-workspace-dashboard.contracts"

/** Asks for the owner dashboard of a period. */
export class GetWorkspaceDashboardQuery extends Query<WorkspaceDashboardData> {
    constructor(readonly params: ExecuteParams<GetWorkspaceDashboardRequest>) {
        super()
    }
}
