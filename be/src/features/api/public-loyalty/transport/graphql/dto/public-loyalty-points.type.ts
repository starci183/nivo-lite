import { Field, ObjectType, Int } from "@nestjs/graphql"
import { PublicLoyaltyNextTierType } from "./public-loyalty-next-tier.type"
import { PublicLoyaltyExpiringType } from "./public-loyalty-expiring.type"
import { PublicLoyaltyRewardType } from "./public-loyalty-reward.type"

@ObjectType()
/** The points and rewards unlocked by a valid code. */
export class PublicLoyaltyPointsType {
    /** The shop name. */
    @Field()
    shop!: string

    /** The member name. */
    @Field()
    name!: string

    /** The current tier name. */
    @Field()
    tierName!: string

    /** The available points. */
    @Field(() => Int)
    points!: number

    /** The next tier when the member can advance. */
    @Field(() => PublicLoyaltyNextTierType, { nullable: true })
    nextTier!: PublicLoyaltyNextTierType | null

    /** The points expiring soon. */
    @Field(() => PublicLoyaltyExpiringType)
    expiring!: PublicLoyaltyExpiringType

    /** The active rewards with member eligibility. */
    @Field(() => [PublicLoyaltyRewardType])
    rewards!: ReadonlyArray<PublicLoyaltyRewardType>
}
