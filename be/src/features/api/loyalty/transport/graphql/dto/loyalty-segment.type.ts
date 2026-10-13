import { Field, ObjectType, Int, Float } from "@nestjs/graphql"

@ObjectType()
/** The loyalty segment fields exposed through GraphQL. */
export class LoyaltySegmentType {
    /** The tiers. */
    @Field(() => [String])
    tiers!: ReadonlyArray<string>

    /** The inactive days. */
    @Field(() => Int)
    inactiveDays!: number

    /** The birthday this month. */
    @Field(() => Boolean)
    birthdayThisMonth!: boolean

    /** The min spend vnd. */
    @Field(() => Float)
    minSpendVnd!: number
}
