import { Module } from "@nestjs/common"
import { GetLoyaltyCampaignResolver } from "./get-loyalty-campaign.resolver"
import { DraftCampaignResolver } from "./draft-campaign.resolver"
import { ConfigurableModuleClass } from "./loyalty-graphql.module-definition"
import { SubmitLoyaltyCampaignResolver } from "./submit-loyalty-campaign.resolver"
import { LoyaltyApiModule } from "../../loyalty.module"
import { LoyaltyBoardResolver } from "./loyalty-board.resolver"
import { LoyaltyProgramResolver } from "./loyalty-program.resolver"
import { LoyaltyMemberResolver } from "./loyalty-member.resolver"
import { AdjustLoyaltyPointsResolver } from "./adjust-loyalty-points.resolver"
import { RedeemLoyaltyRewardResolver } from "./redeem-loyalty-reward.resolver"
import { SyncLoyaltyMembersResolver } from "./sync-loyalty-members.resolver"
import { PreviewLoyaltySegmentResolver } from "./preview-loyalty-segment.resolver"
import { SaveLoyaltyProgramResolver } from "./save-loyalty-program.resolver"
import { SaveLoyaltyRewardResolver } from "./save-loyalty-reward.resolver"
import { RemoveLoyaltyRewardResolver } from "./remove-loyalty-reward.resolver"
import { AddLoyaltyPresetRewardsResolver } from "./add-loyalty-preset-rewards.resolver"
import { UpdateLoyaltyMemberResolver } from "./update-loyalty-member.resolver"

@Module({
    imports: [LoyaltyApiModule.register({})],
    providers: [
        GetLoyaltyCampaignResolver,
        DraftCampaignResolver,
        SubmitLoyaltyCampaignResolver,
        LoyaltyBoardResolver,
        LoyaltyProgramResolver,
        LoyaltyMemberResolver,
        AdjustLoyaltyPointsResolver,
        RedeemLoyaltyRewardResolver,
        SyncLoyaltyMembersResolver,
        PreviewLoyaltySegmentResolver,
        SaveLoyaltyProgramResolver,
        SaveLoyaltyRewardResolver,
        RemoveLoyaltyRewardResolver,
        AddLoyaltyPresetRewardsResolver,
        UpdateLoyaltyMemberResolver,
    ],
})
/** Exposes the loyalty workbench through GraphQL. */
export class LoyaltyGraphqlModule extends ConfigurableModuleClass {}
