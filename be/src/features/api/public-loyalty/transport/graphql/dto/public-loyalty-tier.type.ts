import { Field, ObjectType, Float, Int } from "@nestjs/graphql"

@ObjectType()
/** The next membership tier. */
export class PublicLoyaltyTierType {
    /** The tier key. */
    @Field()
    key!: string

    /** The tier name. */
    @Field()
    name!: string

    /** The lifetime spend needed for this tier. */
    @Field(() => Float)
    minSpendVnd!: number

    /** The points earning multiplier. */
    @Field(() => Float)
    multiplier!: number

    /** The win-back delay in days. */
    @Field(() => Int)
    winbackDays!: number

    /** The benefit of this tier. */
    @Field()
    benefit!: string
}
