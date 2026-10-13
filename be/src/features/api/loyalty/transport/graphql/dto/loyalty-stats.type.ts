import { Field, ObjectType, Int, Float } from "@nestjs/graphql"
import { LoyaltyTierCountType } from "./loyalty-tier-count.type"

@ObjectType()
/** The loyalty stats fields exposed through GraphQL. */
export class LoyaltyStatsType {
    /** The members. */
    @Field(() => Int)
    members!: number

    /** The active90d. */
    @Field(() => Int)
    active90d!: number

    /** The points outstanding. */
    @Field(() => Float)
    pointsOutstanding!: number

    /** The earned30d. */
    @Field(() => Float)
    earned30d!: number

    /** The redeemed30d. */
    @Field(() => Float)
    redeemed30d!: number

    /** The expired30d. */
    @Field(() => Float)
    expired30d!: number

    /** The redemptions30d. */
    @Field(() => Int)
    redemptions30d!: number

    /** The spend30d. */
    @Field(() => Float)
    spend30d!: number

    /** The reward value30d. */
    @Field(() => Float)
    rewardValue30d!: number

    /** The promos sent30d. */
    @Field(() => Int)
    promosSent30d!: number

    /** The birthdays this month. */
    @Field(() => Int)
    birthdaysThisMonth!: number

    /** The tier counts. */
    @Field(() => [LoyaltyTierCountType])
    tierCounts!: ReadonlyArray<LoyaltyTierCountType>
}
