import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
/** An active reward and whether the member can redeem it. */
export class PublicLoyaltyRewardType {
    /** The reward name. */
    @Field()
    name!: string

    /** The cost in points. */
    @Field(() => Int)
    pointsCost!: number

    /** The reward note. */
    @Field()
    note!: string

    /** Whether this member meets the redemption requirements. */
    @Field()
    canRedeem!: boolean
}
