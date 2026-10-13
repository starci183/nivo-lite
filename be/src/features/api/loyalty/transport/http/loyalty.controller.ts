import { Body, Controller, Get, Param, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetLoyaltyOverviewQuery } from "../../application/get-loyalty-overview.query"
import { toGetLoyaltyOverviewRequest, toGetLoyaltyOverviewResponse } from "./get-loyalty-overview.mapper"
import { GetLoyaltyOverviewParamsRequest } from "./dto/get-loyalty-overview.request"
import type { GetLoyaltyOverviewResponse } from "./dto/get-loyalty-overview.response"
import { GetMemberDetailQuery } from "../../application/get-member-detail.query"
import { toGetMemberDetailRequest, toGetMemberDetailResponse } from "./get-member-detail.mapper"
import { GetMemberDetailParamsRequest } from "./dto/get-member-detail.request"
import type { GetMemberDetailResponse } from "./dto/get-member-detail.response"
import { AdjustPointsCommand } from "../../application/adjust-points.command"
import { toAdjustPointsRequest, toAdjustPointsResponse } from "./adjust-points.mapper"
import { AdjustPointsParamsRequest, AdjustPointsBodyRequest } from "./dto/adjust-points.request"
import type { AdjustPointsResponse } from "./dto/adjust-points.response"
import { RedeemRewardCommand } from "../../application/redeem-reward.command"
import { toRedeemRewardRequest, toRedeemRewardResponse } from "./redeem-reward.mapper"
import { RedeemRewardParamsRequest, RedeemRewardBodyRequest } from "./dto/redeem-reward.request"
import type { RedeemRewardResponse } from "./dto/redeem-reward.response"
import { SyncMembersCommand } from "../../application/sync-members.command"
import { toSyncMembersRequest, toSyncMembersResponse } from "./sync-members.mapper"
import { SyncMembersParamsRequest } from "./dto/sync-members.request"
import type { SyncMembersResponse } from "./dto/sync-members.response"
import { PreviewSegmentCommand } from "../../application/preview-segment.command"
import { toPreviewSegmentRequest, toPreviewSegmentResponse } from "./preview-segment.mapper"
import { PreviewSegmentParamsRequest, PreviewSegmentBodyRequest } from "./dto/preview-segment.request"
import type { PreviewSegmentResponse } from "./dto/preview-segment.response"
import { DraftCampaignCommand } from "../../application/draft-campaign.command"
import { toDraftCampaignRequest, toDraftCampaignResponse } from "./draft-campaign.mapper"
import { DraftCampaignParamsRequest, DraftCampaignBodyRequest } from "./dto/draft-campaign.request"
import type { DraftCampaignResponse } from "./dto/draft-campaign.response"

@Controller("loyalty/workspaces/:workspaceId")
/** The owner workbench of the loyalty programme. */
export class LoyaltyController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** Shows the statistics and the ribbon of the workbench. */
    @Get("overview")
    async getLoyaltyOverview(
        @CurrentPrincipal() principal: Principal,
        @Param() params: GetLoyaltyOverviewParamsRequest,
    ): Promise<GetLoyaltyOverviewResponse> {
        const result = await this.queryBus.execute(
            new GetLoyaltyOverviewQuery({ request: toGetLoyaltyOverviewRequest(params), principal }),
        )
        return toGetLoyaltyOverviewResponse(result)
    }

    /** Shows one customer with the ledger and what they can redeem. */
    @Get("members/:customerId")
    async getMemberDetail(
        @CurrentPrincipal() principal: Principal,
        @Param() params: GetMemberDetailParamsRequest,
    ): Promise<GetMemberDetailResponse> {
        const result = await this.queryBus.execute(
            new GetMemberDetailQuery({ request: toGetMemberDetailRequest(params), principal }),
        )
        return toGetMemberDetailResponse(result)
    }

    /** Adds or takes points by hand. */
    @Post("members/:customerId/adjust")
    async adjustPoints(
        @CurrentPrincipal() principal: Principal,
        @Param() params: AdjustPointsParamsRequest,
        @Body() body: AdjustPointsBodyRequest,
    ): Promise<AdjustPointsResponse> {
        const result = await this.commandBus.execute(
            new AdjustPointsCommand({ request: toAdjustPointsRequest(params, body), principal }),
        )
        return toAdjustPointsResponse(result)
    }

    /** Redeems a reward for a customer at the counter. */
    @Post("members/:customerId/redeem")
    async redeemReward(
        @CurrentPrincipal() principal: Principal,
        @Param() params: RedeemRewardParamsRequest,
        @Body() body: RedeemRewardBodyRequest,
    ): Promise<RedeemRewardResponse> {
        const result = await this.commandBus.execute(
            new RedeemRewardCommand({ request: toRedeemRewardRequest(params, body), principal }),
        )
        return toRedeemRewardResponse(result)
    }

    /** Makes customers of the leads. */
    @Post("members/sync")
    async syncMembers(
        @CurrentPrincipal() principal: Principal,
        @Param() params: SyncMembersParamsRequest,
    ): Promise<SyncMembersResponse> {
        const result = await this.commandBus.execute(
            new SyncMembersCommand({ request: toSyncMembersRequest(params), principal }),
        )
        return toSyncMembersResponse(result)
    }

    /** Shows who a segment holds. */
    @Post("campaigns/preview")
    async previewSegment(
        @CurrentPrincipal() principal: Principal,
        @Param() params: PreviewSegmentParamsRequest,
        @Body() body: PreviewSegmentBodyRequest,
    ): Promise<PreviewSegmentResponse> {
        const result = await this.commandBus.execute(
            new PreviewSegmentCommand({ request: toPreviewSegmentRequest(params, body), principal }),
        )
        return toPreviewSegmentResponse(result)
    }

    /** Writes the draft of a promotion to a segment. */
    @Post("campaigns")
    async draftCampaign(
        @CurrentPrincipal() principal: Principal,
        @Param() params: DraftCampaignParamsRequest,
        @Body() body: DraftCampaignBodyRequest,
    ): Promise<DraftCampaignResponse> {
        const result = await this.commandBus.execute(
            new DraftCampaignCommand({ request: toDraftCampaignRequest(params, body), principal }),
        )
        return toDraftCampaignResponse(result)
    }
}
