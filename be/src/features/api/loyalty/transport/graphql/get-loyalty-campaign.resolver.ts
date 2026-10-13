import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetLoyaltyCampaignQuery } from "../../application/get-loyalty-campaign.query"
import { LoyaltyCampaignInput } from "./dto/loyalty-campaign.input"
import { LoyaltyCampaignViewType } from "./dto/loyalty-campaign-view.type"
import { toGetLoyaltyCampaignRequest, toGetLoyaltyCampaignType } from "./get-loyalty-campaign.mapper"

@Resolver()
/** GraphQL status door for campaign drafting and delivery. */
export class GetLoyaltyCampaignResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads one campaign after the application proves workspace membership. */
    @Query(() => LoyaltyCampaignViewType, { name: "loyaltyCampaign" })
    async loyaltyCampaign(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LoyaltyCampaignInput,
    ): Promise<LoyaltyCampaignViewType> {
        const result = await this.queryBus.execute(
            new GetLoyaltyCampaignQuery({
                request: toGetLoyaltyCampaignRequest(workspaceId, input),
                principal,
            }),
        )
        return toGetLoyaltyCampaignType(result)
    }
}
