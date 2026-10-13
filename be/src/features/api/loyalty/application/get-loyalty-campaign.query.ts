import { Query } from "@nestjs/cqrs"
import type { LoyaltyCampaignView } from "@modules/domain/loyalty-campaigns"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetLoyaltyCampaignRequest } from "./get-loyalty-campaign.contracts"

/** Reads one campaign's draft and delivery status. */
export class GetLoyaltyCampaignQuery extends Query<LoyaltyCampaignView> {
    constructor(readonly params: ExecuteParams<GetLoyaltyCampaignRequest>) {
        super()
    }
}
