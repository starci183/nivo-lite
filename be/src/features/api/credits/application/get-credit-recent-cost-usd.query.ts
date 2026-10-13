import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetCreditRecentCostUsdRequest } from "./get-credit-recent-cost-usd.contracts"

/** Asks for get credit recent cost usd. */
export class GetCreditRecentCostUsdQuery extends Query<number> {
    constructor(readonly params: ExecuteParams<GetCreditRecentCostUsdRequest>) {
        super()
    }
}
