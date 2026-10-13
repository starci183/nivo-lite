import { Module } from "@nestjs/common"
import { GetLoyaltyOverviewHandler } from "./application/get-loyalty-overview.handler"
import { GetMemberDetailHandler } from "./application/get-member-detail.handler"
import { AdjustPointsHandler } from "./application/adjust-points.handler"
import { RedeemRewardHandler } from "./application/redeem-reward.handler"
import { SyncMembersHandler } from "./application/sync-members.handler"
import { PreviewSegmentHandler } from "./application/preview-segment.handler"
import { DraftCampaignHandler } from "./application/draft-campaign.handler"

@Module({
    providers: [
        GetLoyaltyOverviewHandler,
        GetMemberDetailHandler,
        AdjustPointsHandler,
        RedeemRewardHandler,
        SyncMembersHandler,
        PreviewSegmentHandler,
        DraftCampaignHandler,
    ],
})
/** The loyalty feature: the handlers of its application. */
export class LoyaltyApiModule {}
