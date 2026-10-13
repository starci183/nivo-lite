import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { GetLoyaltyPageRequest, GetLoyaltyPageResult } from "./get-loyalty-page.contracts"

/** Shows the name of the shop for the points page. */
export class GetLoyaltyPageQuery extends Query<GetLoyaltyPageResult> {
    constructor(readonly params: PublicExecuteParams<GetLoyaltyPageRequest>) {
        super()
    }
}
