import { Field, ObjectType, Int, Float } from "@nestjs/graphql"

@ObjectType()
/** The loyalty figures fields exposed through GraphQL. */
export class LoyaltyFiguresType {
    /** The members. */
    @Field(() => Int)
    members!: number

    /** The active members. */
    @Field(() => Int)
    activeMembers!: number

    /** The points issued30d. */
    @Field(() => Float)
    pointsIssued30d!: number

    /** The redemptions30d. */
    @Field(() => Int)
    redemptions30d!: number

    /** The points redeemed30d. */
    @Field(() => Float)
    pointsRedeemed30d!: number

    /** The at risk. */
    @Field(() => Int)
    atRisk!: number
}
