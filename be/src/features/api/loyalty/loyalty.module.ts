import { Module } from "@nestjs/common"
import { GetLoyaltyCampaignHandler } from "./application/get-loyalty-campaign.handler"
import { UpdateLoyaltyMemberHandler } from "./application/update-loyalty-member.handler"
import { AddLoyaltyPresetRewardsHandler } from "./application/add-loyalty-preset-rewards.handler"
import { RemoveLoyaltyRewardHandler } from "./application/remove-loyalty-reward.handler"
import { SaveLoyaltyRewardHandler } from "./application/save-loyalty-reward.handler"
import { SaveLoyaltyProgramHandler } from "./application/save-loyalty-program.handler"
import { GetLoyaltyProgramHandler } from "./application/get-loyalty-program.handler"
import { GetLoyaltyBoardHandler } from "./application/get-loyalty-board.handler"
import { GetLoyaltyOverviewHandler } from "./application/get-loyalty-overview.handler"
import { GetMemberDetailHandler } from "./application/get-member-detail.handler"
import { AdjustPointsHandler } from "./application/adjust-points.handler"
import { RedeemRewardHandler } from "./application/redeem-reward.handler"
import { SyncMembersHandler } from "./application/sync-members.handler"
import { PreviewSegmentHandler } from "./application/preview-segment.handler"
import { DraftCampaignHandler } from "./application/draft-campaign.handler"
import { SubmitLoyaltyCampaignHandler } from "./application/submit-loyalty-campaign.handler"
import { ConfigurableModuleClass } from "./loyalty.module-definition"

@Module({
    providers: [
        GetLoyaltyCampaignHandler,
        GetLoyaltyBoardHandler,
        GetLoyaltyProgramHandler,
        SaveLoyaltyProgramHandler,
        SaveLoyaltyRewardHandler,
        RemoveLoyaltyRewardHandler,
        AddLoyaltyPresetRewardsHandler,
        UpdateLoyaltyMemberHandler,
        GetLoyaltyOverviewHandler,
        GetMemberDetailHandler,
        AdjustPointsHandler,
        RedeemRewardHandler,
        SyncMembersHandler,
        PreviewSegmentHandler,
        DraftCampaignHandler,
        SubmitLoyaltyCampaignHandler,
    ],
})
/** The loyalty feature: the handlers of its application. */
export class LoyaltyApiModule extends ConfigurableModuleClass {}
