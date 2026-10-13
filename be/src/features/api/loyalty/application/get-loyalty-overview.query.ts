import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetLoyaltyOverviewRequest, GetLoyaltyOverviewResult } from "./get-loyalty-overview.contracts"

/** Shows the statistics and the ribbon of the workbench. */
export class GetLoyaltyOverviewQuery extends Query<GetLoyaltyOverviewResult> {
    constructor(readonly params: ExecuteParams<GetLoyaltyOverviewRequest>) {
        super()
    }
}
