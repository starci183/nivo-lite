import { Field, ObjectType, Float, Int } from "@nestjs/graphql"

@ObjectType()
/** The loyalty tier fields exposed through GraphQL. */
export class LoyaltyTierType {
    /** The key. */
    @Field(() => String)
    key!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The min spend vnd. */
    @Field(() => Float)
    minSpendVnd!: number

    /** The multiplier. */
    @Field(() => Float)
    multiplier!: number

    /** The winback days. */
    @Field(() => Int)
    winbackDays!: number

    /** The benefit. */
    @Field(() => String)
    benefit!: string
}
