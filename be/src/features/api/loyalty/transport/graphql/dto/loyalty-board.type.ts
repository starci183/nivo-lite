import { Field, ObjectType } from "@nestjs/graphql"
import { LoyaltyProgramType } from "./loyalty-program.type"
import { LoyaltyConfigType } from "./loyalty-config.type"
import { LoyaltyStatsType } from "./loyalty-stats.type"
import { LoyaltyFiguresType } from "./loyalty-figures.type"
import { LoyaltyMemberType } from "./loyalty-member.type"
import { LoyaltyRewardType } from "./loyalty-reward.type"
import { LoyaltyCampaignViewType } from "./loyalty-campaign-view.type"

@ObjectType()
/** The loyalty board fields exposed through GraphQL. */
export class LoyaltyBoardType {
    /** The program. */
    @Field(() => LoyaltyProgramType, { nullable: true })
    program!: LoyaltyProgramType | null

    /** The config. */
    @Field(() => LoyaltyConfigType)
    config!: LoyaltyConfigType

    /** The stats. */
    @Field(() => LoyaltyStatsType)
    stats!: LoyaltyStatsType

    /** The figures. */
    @Field(() => LoyaltyFiguresType)
    figures!: LoyaltyFiguresType

    /** The members. */
    @Field(() => [LoyaltyMemberType])
    members!: ReadonlyArray<LoyaltyMemberType>

    /** The rewards. */
    @Field(() => [LoyaltyRewardType])
    rewards!: ReadonlyArray<LoyaltyRewardType>

    /** The campaigns. */
    @Field(() => [LoyaltyCampaignViewType])
    campaigns!: ReadonlyArray<LoyaltyCampaignViewType>

    /** The can manage. */
    @Field(() => Boolean)
    canManage!: boolean

    /** The now iso. */
    @Field(() => String)
    nowIso!: string
}
