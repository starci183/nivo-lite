import { Query } from "@nestjs/cqrs"
import type { OverviewSnapshot } from "@modules/domain/overview"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetDashboardRequest } from "./get-dashboard.contracts"

/** Asks for everything the executive dashboard shows about the workspace. */
export class GetDashboardQuery extends Query<OverviewSnapshot> {
    constructor(readonly params: ExecuteParams<GetDashboardRequest>) {
        super()
    }
}
