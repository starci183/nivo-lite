import { QueryHandler } from "@nestjs/cqrs"
import { LoyaltyCampaignWorkbenchService } from "@modules/domain/loyalty"
import type { LoyaltyCampaignView } from "@modules/domain/loyalty-campaigns"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetLoyaltyCampaignQuery } from "./get-loyalty-campaign.query"

@QueryHandler(GetLoyaltyCampaignQuery)
/** Delegates one workspace-scoped campaign read to the authorized workbench service. */
export class GetLoyaltyCampaignHandler extends ICQRSHandler<GetLoyaltyCampaignQuery, LoyaltyCampaignView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly campaigns: LoyaltyCampaignWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(query: GetLoyaltyCampaignQuery): Promise<LoyaltyCampaignView> {
        return this.campaigns.campaign(query.params.principal.id, query.params.request)
    }
}
