import { Field, ObjectType, ID, Float, Int } from "@nestjs/graphql"

@ObjectType()
/** The loyalty reward fields exposed through GraphQL. */
export class LoyaltyRewardType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The key. */
    @Field(() => String)
    key!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The kind. */
    @Field(() => String)
    kind!: string

    /** The value vnd. */
    @Field(() => Float)
    valueVnd!: number

    /** The percent. */
    @Field(() => Int, { nullable: true })
    percent!: number | null

    /** The points cost. */
    @Field(() => Int)
    pointsCost!: number

    /** The stock. */
    @Field(() => Int, { nullable: true })
    stock!: number | null

    /** The per customer limit. */
    @Field(() => Int, { nullable: true })
    perCustomerLimit!: number | null

    /** The min tier key. */
    @Field(() => String, { nullable: true })
    minTierKey!: string | null

    /** The note. */
    @Field(() => String)
    note!: string

    /** The active. */
    @Field(() => Boolean)
    active!: boolean
}
